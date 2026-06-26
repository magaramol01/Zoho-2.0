import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { TaskPatch, TaskRow } from "@zoho-power-grid/shared";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { DatabaseService } from "../db/database.service";
import {
  mutationAuditTable,
  priorityCacheTable,
  projectCacheTable,
  sprintCacheTable,
  statusCacheTable,
  syncStateTable,
  taskCacheTable,
  timesheetLogCacheTable,
  userCacheTable,
} from "../db/schema";
import { EventBusService } from "../events/event-bus.service";
import type { TaskBulkDto, TaskQueryDto } from "./dto";
import type { CreateTaskLogDto } from "../timesheet/dto";
import { SyncService } from "../sync/sync.service";
import { ZohoApiClient } from "../zoho/zoho-api.client";
import { ZohoNormalizer } from "../zoho/zoho-normalizer";
import {
  toZohoBooleanFlag,
  toZohoLogDateTime,
  toZohoLogDuration,
} from "../zoho/zoho-timesheet";

const parseJsonList = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
};

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly zohoApiClient: ZohoApiClient,
    private readonly eventBus: EventBusService,
    private readonly zohoNormalizer: ZohoNormalizer,
    private readonly syncService: SyncService,
  ) {}

  toTaskRow(row: typeof taskCacheTable.$inferSelect): TaskRow {
    return {
      id: row.id,
      itemNo: row.itemNo,
      description: row.description,
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      projectName: row.projectName,
      sprintId: row.sprintId,
      sprintName: row.sprintName,
      name: row.name,
      statusId: row.statusId,
      statusName: row.statusName,
      priorityId: row.priorityId,
      priorityName: row.priorityName,
      assigneeIds: parseJsonList(row.assigneeIdsJson),
      assigneeNames: parseJsonList(row.assigneeNamesJson),
      dueDate: row.dueDate,
      estimatedMinutes: row.estimatedMinutes,
      loggedMinutes: row.loggedMinutes,
      remainingMinutes: row.remainingMinutes,
      tagIds: parseJsonList(row.tagIdsJson),
      tagNames: parseJsonList(row.tagNamesJson),
      updatedAt: row.updatedAt,
    };
  }

  private async resolveMissingStatusNames(userId: string, rows: Array<typeof taskCacheTable.$inferSelect>) {
    const unresolvedStatusIds = [...new Set(
      rows
        .filter((row) => !row.statusName.trim())
        .map((row) => row.statusId)
        .filter(Boolean),
    )];

    if (!unresolvedStatusIds.length) {
      return rows;
    }

    const fallbackStatuses = await this.db.db
      .select({
        id: statusCacheTable.id,
        name: statusCacheTable.name,
      })
      .from(statusCacheTable)
      .where(and(eq(statusCacheTable.ownerId, userId), inArray(statusCacheTable.id, unresolvedStatusIds)));

    if (!fallbackStatuses.length) {
      return rows;
    }

    const fallbackStatusMap = new Map(
      fallbackStatuses.map((status) => [status.id, status.name]),
    );

    const resolvedRows = rows.map((row) => ({
      ...row,
      statusName: row.statusName || fallbackStatusMap.get(row.statusId) || row.statusName,
    }));

    const rowsToPersist = resolvedRows.filter(
      (row, index) =>
        !rows[index]?.statusName.trim() && row.statusName.trim(),
    );

    for (const row of rowsToPersist) {
      await this.db.db
        .update(taskCacheTable)
        .set({
          statusName: row.statusName,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(taskCacheTable.id, row.id), eq(taskCacheTable.ownerId, userId)));
    }

    return resolvedRows;
  }

  async getTasks(userId: string, query: TaskQueryDto) {
    await this.syncTasksIfStale(userId, query);

    const filters = [eq(taskCacheTable.ownerId, userId)];
    const currentZohoUserId = await this.getCurrentZohoUserId(userId);
    const shouldFilterMine = query.mine !== "false";

    if (query.projectId) {
      filters.push(eq(taskCacheTable.projectId, query.projectId));
    }
    if (query.sprintId) {
      filters.push(eq(taskCacheTable.sprintId, query.sprintId));
    }
    if (query.statusId) {
      filters.push(eq(taskCacheTable.statusId, query.statusId));
    }
    if (query.search) {
      filters.push(like(taskCacheTable.name, `%${query.search}%`));
    }
    if (shouldFilterMine && currentZohoUserId) {
      filters.push(like(taskCacheTable.assigneeIdsJson, `%"${currentZohoUserId}"%`));
    }

    const rows = await this.db.db
      .select()
      .from(taskCacheTable)
      .where(and(...filters))
      .orderBy(desc(taskCacheTable.updatedAt));

    const resolvedRows = await this.resolveMissingStatusNames(userId, rows);

    return resolvedRows.map((row) => this.toTaskRow(row));
  }

  async syncTasksIfStale(userId: string, query: TaskQueryDto, force = false) {
    if (!(await this.zohoApiClient.canUseZoho(userId))) {
      return;
    }

    await this.syncService.syncMetadata(userId, force);

    const [latestRow] = await this.db.db
      .select()
      .from(taskCacheTable)
      .where(eq(taskCacheTable.ownerId, userId))
      .orderBy(desc(taskCacheTable.syncedAt))
      .limit(1);
    if (!force && latestRow && Date.now() - new Date(latestRow.syncedAt).getTime() < 45_000) {
      return;
    }

    const projectFilters = query.projectId
      ? await this.db.db.select().from(projectCacheTable).where(and(eq(projectCacheTable.id, query.projectId), eq(projectCacheTable.ownerId, userId)))
      : await this.db.db.select().from(projectCacheTable).where(eq(projectCacheTable.ownerId, userId));

    if (!projectFilters.length) {
      return;
    }

    let syncedAny = false;

    for (const project of projectFilters) {
      const [sprints, statuses, priorities, users] = await Promise.all([
        query.sprintId
          ? this.db.db
              .select()
              .from(sprintCacheTable)
              .where(and(eq(sprintCacheTable.id, query.sprintId), eq(sprintCacheTable.ownerId, userId)))
          : this.db.db
              .select()
              .from(sprintCacheTable)
              .where(and(eq(sprintCacheTable.projectId, project.id), eq(sprintCacheTable.ownerId, userId))),
        this.db.db.select().from(statusCacheTable).where(and(eq(statusCacheTable.workspaceId, project.workspaceId), eq(statusCacheTable.ownerId, userId))),
        this.db.db.select().from(priorityCacheTable).where(and(eq(priorityCacheTable.projectId, project.id), eq(priorityCacheTable.ownerId, userId))),
        this.db.db.select().from(userCacheTable).where(and(eq(userCacheTable.workspaceId, project.workspaceId), eq(userCacheTable.ownerId, userId))),
      ]);

      const statusMap = new Map(statuses.map((status) => [status.id, status.name]));
      const priorityMap = new Map(priorities.map((priority) => [priority.id, priority.name]));
      const userMap = new Map(users.map((user) => [user.id, user.name]));
      const sprintMap = new Map(sprints.map((sprint) => [sprint.id, sprint.name]));

      for (const sprint of sprints) {
        try {
          const payload = await this.zohoApiClient.request<unknown>(userId, {
            path: `/zsapi/team/${project.workspaceId}/projects/${project.id}/sprints/${sprint.id}/item/`,
            query: {
              action: "data",
              index: 1,
              range: 250,
              subitem: true,
              searchvalue: query.search,
            },
          });

          const tasks = this.zohoNormalizer.normalizeTasks(payload);
          const syncedAt = new Date().toISOString();

          for (const task of tasks) {
            const taskSprintId = task.sprintId ?? sprint.id;
            const assigneeNames =
              task.assigneeNames.length > 0
                ? task.assigneeNames
                : task.assigneeIds.map((assigneeId) => userMap.get(assigneeId) ?? assigneeId).filter(Boolean);
            const loggedMinutes =
              task.loggedMinutes > 0
                ? task.loggedMinutes
                : await this.lookupLoggedMinutes(userId, task.id);
            const normalizedTask: TaskRow = {
              ...task,
              description: task.description,
              workspaceId: project.workspaceId,
              projectId: project.id,
              projectName: project.name,
              sprintId: taskSprintId,
              sprintName: sprintMap.get(taskSprintId) ?? task.sprintName ?? sprint.name,
              statusName: statusMap.get(task.statusId) || task.statusName || "Unknown",
              priorityName: task.priorityId ? priorityMap.get(task.priorityId) ?? task.priorityName ?? null : null,
              assigneeNames,
              loggedMinutes,
              remainingMinutes:
                task.remainingMinutes ??
                (task.estimatedMinutes === null ? null : Math.max(0, task.estimatedMinutes - loggedMinutes)),
            };

            await this.db.db
              .insert(taskCacheTable)
              .values({
                id: normalizedTask.id,
                ownerId: userId,
                itemNo: normalizedTask.itemNo,
                description: normalizedTask.description,
                workspaceId: normalizedTask.workspaceId,
                projectId: normalizedTask.projectId,
                projectName: normalizedTask.projectName,
                sprintId: normalizedTask.sprintId,
                sprintName: normalizedTask.sprintName,
                name: normalizedTask.name,
                statusId: normalizedTask.statusId,
                statusName: normalizedTask.statusName,
                priorityId: normalizedTask.priorityId,
                priorityName: normalizedTask.priorityName,
                assigneeIdsJson: JSON.stringify(normalizedTask.assigneeIds),
                assigneeNamesJson: JSON.stringify(normalizedTask.assigneeNames),
                dueDate: normalizedTask.dueDate,
                estimatedMinutes: normalizedTask.estimatedMinutes,
                loggedMinutes: normalizedTask.loggedMinutes,
                remainingMinutes: normalizedTask.remainingMinutes,
                tagIdsJson: JSON.stringify(normalizedTask.tagIds),
                tagNamesJson: JSON.stringify(normalizedTask.tagNames),
                rawJson: JSON.stringify(normalizedTask),
                syncedAt,
              })
              .onConflictDoUpdate({
                target: [taskCacheTable.id, taskCacheTable.ownerId],
                set: {
                  itemNo: normalizedTask.itemNo,
                  description: normalizedTask.description,
                  workspaceId: normalizedTask.workspaceId,
                  projectId: normalizedTask.projectId,
                  projectName: normalizedTask.projectName,
                  sprintId: normalizedTask.sprintId,
                  sprintName: normalizedTask.sprintName,
                  name: normalizedTask.name,
                  statusId: normalizedTask.statusId,
                  statusName: normalizedTask.statusName,
                  priorityId: normalizedTask.priorityId,
                  priorityName: normalizedTask.priorityName,
                  assigneeIdsJson: JSON.stringify(normalizedTask.assigneeIds),
                  assigneeNamesJson: JSON.stringify(normalizedTask.assigneeNames),
                  dueDate: normalizedTask.dueDate,
                  estimatedMinutes: normalizedTask.estimatedMinutes,
                  loggedMinutes: normalizedTask.loggedMinutes,
                  remainingMinutes: normalizedTask.remainingMinutes,
                  tagIdsJson: JSON.stringify(normalizedTask.tagIds),
                  tagNamesJson: JSON.stringify(normalizedTask.tagNames),
                  rawJson: JSON.stringify(normalizedTask),
                  syncedAt,
                  updatedAt: syncedAt,
                },
              });
          }

          syncedAny = true;
        } catch (error) {
          this.logger.warn(
            `Task sync skipped for project ${project.id} sprint ${sprint.id} user ${userId}: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        }
      }
    }

    if (syncedAny) {
      this.eventBus.emit({ type: "sync", scope: "tasks", at: new Date().toISOString() });
    }
  }

  async updateTask(userId: string, taskId: string, patch: TaskPatch) {
    const [existing] = await this.db.db.select().from(taskCacheTable).where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId))).limit(1);
    if (!existing) {
      throw new NotFoundException("Task not found");
    }

    const [statusRow] =
      patch.statusId && patch.statusId !== existing.statusId
        ? await this.db.db
            .select({
              name: statusCacheTable.name,
            })
            .from(statusCacheTable)
            .where(and(eq(statusCacheTable.id, patch.statusId), eq(statusCacheTable.ownerId, userId)))
            .limit(1)
        : [];
    const [priorityRow] =
      patch.priorityId !== undefined && patch.priorityId !== existing.priorityId && patch.priorityId !== null
        ? await this.db.db
            .select({
              name: priorityCacheTable.name,
            })
            .from(priorityCacheTable)
            .where(and(eq(priorityCacheTable.id, patch.priorityId), eq(priorityCacheTable.ownerId, userId)))
            .limit(1)
        : [];

    if ((await this.zohoApiClient.canUseZoho(userId)) && existing.sprintId) {
      await this.zohoApiClient.request(userId, {
        path: `/zsapi/team/${existing.workspaceId}/projects/${existing.projectId}/sprints/${existing.sprintId}/item/${taskId}/`,
        method: "POST",
        query: {
          name: patch.name ?? existing.name,
          statusid: patch.statusId ?? existing.statusId,
          projpriorityid: patch.priorityId ?? existing.priorityId,
          enddate: patch.dueDate ?? existing.dueDate,
          duration: patch.estimatedMinutes ?? existing.estimatedMinutes,
        },
      });
    }

    const updated = {
      name: patch.name ?? existing.name,
      statusId: patch.statusId ?? existing.statusId,
      statusName: patch.statusId === undefined
        ? existing.statusName
        : statusRow?.name ?? existing.statusName,
      priorityId: patch.priorityId === undefined ? existing.priorityId : patch.priorityId,
      priorityName:
        patch.priorityId === undefined
          ? existing.priorityName
          : patch.priorityId === null
            ? null
            : priorityRow?.name ?? existing.priorityName,
      dueDate: patch.dueDate === undefined ? existing.dueDate : patch.dueDate,
      estimatedMinutes: patch.estimatedMinutes === undefined ? existing.estimatedMinutes : patch.estimatedMinutes,
      remainingMinutes: patch.remainingMinutes === undefined ? existing.remainingMinutes : patch.remainingMinutes,
      assigneeIdsJson: JSON.stringify(patch.assigneeIds ?? parseJsonList(existing.assigneeIdsJson)),
      assigneeNamesJson: existing.assigneeNamesJson,
      tagIdsJson: JSON.stringify(patch.tagIds ?? parseJsonList(existing.tagIdsJson)),
      tagNamesJson: existing.tagNamesJson,
      updatedAt: new Date().toISOString(),
    };

    await this.db.db.update(taskCacheTable).set(updated).where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId)));
    await this.db.db.insert(mutationAuditTable).values({
      id: nanoid(),
      ownerId: userId,
      entityType: "task",
      entityId: taskId,
      action: "update",
      status: "queued",
      payloadJson: JSON.stringify(patch),
    });

    this.eventBus.emit({ type: "task-updated", taskId, at: new Date().toISOString() });

    const [row] = await this.db.db.select().from(taskCacheTable).where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId))).limit(1);
    return this.toTaskRow(row!);
  }

  async bulkUpdate(userId: string, body: TaskBulkDto) {
    const results = [];

    for (const taskId of body.taskIds) {
      if (body.type === "set-status" && body.statusId) {
        results.push(await this.updateTask(userId, taskId, { statusId: body.statusId }));
      }
      if (body.type === "set-priority") {
        results.push(await this.updateTask(userId, taskId, { priorityId: body.priorityId ?? null }));
      }
      if (body.type === "move-sprint") {
        const [task] = await this.db.db.select().from(taskCacheTable).where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId))).limit(1);
        const [project] = body.projectId
          ? await this.db.db.select().from(projectCacheTable).where(and(eq(projectCacheTable.id, body.projectId), eq(projectCacheTable.ownerId, userId))).limit(1)
          : [];
        const [sprint] = body.sprintId
          ? await this.db.db.select().from(sprintCacheTable).where(and(eq(sprintCacheTable.id, body.sprintId), eq(sprintCacheTable.ownerId, userId))).limit(1)
          : [];

        if (task && (await this.zohoApiClient.canUseZoho(userId)) && task.sprintId && body.projectId) {
          await this.zohoApiClient.request(userId, {
            path: `/zsapi/team/${task.workspaceId}/projects/${task.projectId}/sprints/${task.sprintId}/bulkupdate/`,
            method: "POST",
            query: {
              action: "moveitem",
              itemidarr: task.id,
              tosprintid: body.sprintId ?? "",
              toprojectid: body.projectId,
            },
          });
        }

        await this.db.db
          .update(taskCacheTable)
          .set({
            projectId: body.projectId ?? project?.id ?? "",
            projectName: project?.name ?? "",
            sprintId: body.sprintId ?? null,
            sprintName: sprint?.name ?? null,
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId)));
      }
    }

    return {
      ok: true,
      count: body.taskIds.length,
      tasks: body.type === "move-sprint" ? await this.getTasks(userId, { projectId: body.projectId }) : results,
    };
  }

  async addTaskLog(userId: string, taskId: string, body: CreateTaskLogDto) {
    const [task] = await this.db.db.select().from(taskCacheTable).where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId))).limit(1);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    let zohoResponse: unknown = null;
    const [fallbackUser] = await this.db.db.select().from(userCacheTable).where(eq(userCacheTable.ownerId, userId)).limit(1);
    const assigneeIds = parseJsonList(task.assigneeIdsJson);
    const resolvedUserId =
      body.userId ??
      assigneeIds[0] ??
      (await this.getCurrentZohoUserId(userId)) ??
      fallbackUser?.id ??
      "";
    const resolvedUserName =
      (resolvedUserId
        ? (
            await this.db.db
              .select()
              .from(userCacheTable)
              .where(and(eq(userCacheTable.id, resolvedUserId), eq(userCacheTable.ownerId, userId)))
              .limit(1)
          )[0]?.name
        : null) ??
      (await this.getCurrentZohoUserName(userId)) ??
      fallbackUser?.name ??
      null;

    if ((await this.zohoApiClient.canUseZoho(userId)) && task.sprintId) {
      zohoResponse = await this.zohoApiClient.request(userId, {
        path: `/zsapi/team/${task.workspaceId}/projects/${task.projectId}/sprints/${task.sprintId}/item/${taskId}/timesheet/`,
        method: "POST",
        query: {
          action: "additemlog",
          duration: toZohoLogDuration(body.durationMinutes),
          date: toZohoLogDateTime(body.date),
          notes: body.notes ?? "",
          users: resolvedUserId,
          isbillable: toZohoBooleanFlag(body.billable),
        },
      });
    }

    const normalizedZohoLog = this.zohoNormalizer
      .normalizeTimesheetLogs(zohoResponse)
      .find((log) => log.id);
    const logId = normalizedZohoLog?.id ?? nanoid();
    await this.db.db.insert(timesheetLogCacheTable).values({
      id: logId,
      ownerId: userId,
      taskId,
      projectId: task.projectId,
      projectName: task.projectName,
      sprintId: task.sprintId,
      taskName: task.name,
      date: body.date,
      durationMinutes: body.durationMinutes,
      notes: body.notes ?? "",
      userId: normalizedZohoLog?.userId ?? resolvedUserId,
      userName: normalizedZohoLog?.userName ?? resolvedUserName,
      billable: body.billable,
      rawJson: JSON.stringify({
        ...body,
        userId: normalizedZohoLog?.userId ?? resolvedUserId,
        userName: normalizedZohoLog?.userName ?? resolvedUserName,
      }),
      syncedAt: new Date().toISOString(),
    });

    await this.db.db
      .update(taskCacheTable)
      .set({
        loggedMinutes: task.loggedMinutes + body.durationMinutes,
        remainingMinutes:
          task.remainingMinutes === null ? null : Math.max(0, task.remainingMinutes - body.durationMinutes),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId)));

    this.eventBus.emit({ type: "timesheet-updated", at: new Date().toISOString() });

    return { ok: true, taskId, logId };
  }

  private async getCurrentZohoUserId(userId: string) {
    const [row] = await this.db.db
      .select()
      .from(syncStateTable)
      .where(and(eq(syncStateTable.key, "current_zoho_internal_user_id"), eq(syncStateTable.ownerId, userId)))
      .limit(1);
    if (row?.value) {
      return row.value;
    }

    const [fallback] = await this.db.db
      .select()
      .from(syncStateTable)
      .where(and(eq(syncStateTable.key, "current_zoho_user_id"), eq(syncStateTable.ownerId, userId)))
      .limit(1);
    return fallback?.value ?? null;
  }

  private async getCurrentZohoUserName(userId: string) {
    const [row] = await this.db.db
      .select()
      .from(syncStateTable)
      .where(and(eq(syncStateTable.key, "current_zoho_internal_user_name"), eq(syncStateTable.ownerId, userId)))
      .limit(1);
    if (row?.value) {
      return row.value;
    }

    const [fallback] = await this.db.db
      .select()
      .from(syncStateTable)
      .where(and(eq(syncStateTable.key, "current_zoho_user_name"), eq(syncStateTable.ownerId, userId)))
      .limit(1);
    return fallback?.value ?? null;
  }

  private async lookupLoggedMinutes(userId: string, taskId: string) {
    const rows = await this.db.db
      .select()
      .from(timesheetLogCacheTable)
      .where(and(eq(timesheetLogCacheTable.taskId, taskId), eq(timesheetLogCacheTable.ownerId, userId)));
    return rows.reduce((sum, row) => sum + row.durationMinutes, 0);
  }
}
