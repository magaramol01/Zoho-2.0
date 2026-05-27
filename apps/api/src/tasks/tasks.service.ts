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

  private async resolveMissingStatusNames(rows: Array<typeof taskCacheTable.$inferSelect>) {
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
      .where(inArray(statusCacheTable.id, unresolvedStatusIds));

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
        .where(eq(taskCacheTable.id, row.id));
    }

    return resolvedRows;
  }

  async getTasks(query: TaskQueryDto) {
    await this.syncTasksIfStale(query);

    const filters = [];
    const currentZohoUserId = await this.getCurrentZohoUserId();
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
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(taskCacheTable.updatedAt));

    const resolvedRows = await this.resolveMissingStatusNames(rows);

    return resolvedRows.map((row) => this.toTaskRow(row));
  }

  async syncTasksIfStale(query: TaskQueryDto, force = false) {
    if (!(await this.zohoApiClient.canUseZoho())) {
      return;
    }

    await this.syncService.syncMetadata(force);

    const [latestRow] = await this.db.db
      .select()
      .from(taskCacheTable)
      .orderBy(desc(taskCacheTable.syncedAt))
      .limit(1);
    if (!force && latestRow && Date.now() - new Date(latestRow.syncedAt).getTime() < 45_000) {
      return;
    }

    const projectFilters = query.projectId
      ? await this.db.db.select().from(projectCacheTable).where(eq(projectCacheTable.id, query.projectId))
      : await this.db.db.select().from(projectCacheTable);

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
              .where(eq(sprintCacheTable.id, query.sprintId))
          : this.db.db
              .select()
              .from(sprintCacheTable)
              .where(eq(sprintCacheTable.projectId, project.id)),
        this.db.db.select().from(statusCacheTable).where(eq(statusCacheTable.workspaceId, project.workspaceId)),
        this.db.db.select().from(priorityCacheTable).where(eq(priorityCacheTable.projectId, project.id)),
        this.db.db.select().from(userCacheTable).where(eq(userCacheTable.workspaceId, project.workspaceId)),
      ]);

      const statusMap = new Map(statuses.map((status) => [status.id, status.name]));
      const priorityMap = new Map(priorities.map((priority) => [priority.id, priority.name]));
      const userMap = new Map(users.map((user) => [user.id, user.name]));
      const sprintMap = new Map(sprints.map((sprint) => [sprint.id, sprint.name]));

      for (const sprint of sprints) {
        try {
          const payload = await this.zohoApiClient.request<unknown>({
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
                : await this.lookupLoggedMinutes(task.id);
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
                target: taskCacheTable.id,
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
            `Task sync skipped for project ${project.id} sprint ${sprint.id}: ${
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

  async updateTask(taskId: string, patch: TaskPatch) {
    const [existing] = await this.db.db.select().from(taskCacheTable).where(eq(taskCacheTable.id, taskId)).limit(1);
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
            .where(eq(statusCacheTable.id, patch.statusId))
            .limit(1)
        : [];
    const [priorityRow] =
      patch.priorityId !== undefined && patch.priorityId !== existing.priorityId && patch.priorityId !== null
        ? await this.db.db
            .select({
              name: priorityCacheTable.name,
            })
            .from(priorityCacheTable)
            .where(eq(priorityCacheTable.id, patch.priorityId))
            .limit(1)
        : [];

    if ((await this.zohoApiClient.canUseZoho()) && existing.sprintId) {
      await this.zohoApiClient.request({
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

    await this.db.db.update(taskCacheTable).set(updated).where(eq(taskCacheTable.id, taskId));
    await this.db.db.insert(mutationAuditTable).values({
      id: nanoid(),
      entityType: "task",
      entityId: taskId,
      action: "update",
      status: "queued",
      payloadJson: JSON.stringify(patch),
    });

    this.eventBus.emit({ type: "task-updated", taskId, at: new Date().toISOString() });

    const [row] = await this.db.db.select().from(taskCacheTable).where(eq(taskCacheTable.id, taskId)).limit(1);
    return this.toTaskRow(row!);
  }

  async bulkUpdate(body: TaskBulkDto) {
    const results = [];

    for (const taskId of body.taskIds) {
      if (body.type === "set-status" && body.statusId) {
        results.push(await this.updateTask(taskId, { statusId: body.statusId }));
      }
      if (body.type === "set-priority") {
        results.push(await this.updateTask(taskId, { priorityId: body.priorityId ?? null }));
      }
      if (body.type === "move-sprint") {
        const [task] = await this.db.db.select().from(taskCacheTable).where(eq(taskCacheTable.id, taskId)).limit(1);
        const [project] = body.projectId
          ? await this.db.db.select().from(projectCacheTable).where(eq(projectCacheTable.id, body.projectId)).limit(1)
          : [];
        const [sprint] = body.sprintId
          ? await this.db.db.select().from(sprintCacheTable).where(eq(sprintCacheTable.id, body.sprintId)).limit(1)
          : [];

        if (task && (await this.zohoApiClient.canUseZoho()) && task.sprintId && body.projectId) {
          await this.zohoApiClient.request({
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
          .where(eq(taskCacheTable.id, taskId));
      }
    }

    return {
      ok: true,
      count: body.taskIds.length,
      tasks: body.type === "move-sprint" ? await this.getTasks({ projectId: body.projectId }) : results,
    };
  }

  async addTaskLog(taskId: string, body: CreateTaskLogDto) {
    const [task] = await this.db.db.select().from(taskCacheTable).where(eq(taskCacheTable.id, taskId)).limit(1);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if ((await this.zohoApiClient.canUseZoho()) && task.sprintId) {
      const [fallbackUser] = await this.db.db.select().from(userCacheTable).limit(1);
      const assigneeIds = parseJsonList(task.assigneeIdsJson);
      await this.zohoApiClient.request({
        path: `/zsapi/team/${task.workspaceId}/projects/${task.projectId}/sprints/${task.sprintId}/item/${taskId}/timesheet/`,
        method: "POST",
        query: {
          action: "additemlog",
          duration: body.durationMinutes,
          date: body.date,
          notes: body.notes ?? "",
          users: assigneeIds[0] ?? fallbackUser?.id ?? "",
          isbillable: body.billable,
        },
      });
    }

    const logId = nanoid();
    await this.db.db.insert(timesheetLogCacheTable).values({
      id: logId,
      taskId,
      projectId: task.projectId,
      projectName: task.projectName,
      sprintId: task.sprintId,
      taskName: task.name,
      date: body.date,
      durationMinutes: body.durationMinutes,
      notes: body.notes ?? "",
      billable: body.billable,
      rawJson: JSON.stringify(body),
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
      .where(eq(taskCacheTable.id, taskId));

    this.eventBus.emit({ type: "timesheet-updated", at: new Date().toISOString() });

    return { ok: true, taskId, logId };
  }

  private async getCurrentZohoUserId() {
    const [row] = await this.db.db
      .select()
      .from(syncStateTable)
      .where(eq(syncStateTable.key, "current_zoho_internal_user_id"))
      .limit(1);
    if (row?.value) {
      return row.value;
    }

    const [fallback] = await this.db.db
      .select()
      .from(syncStateTable)
      .where(eq(syncStateTable.key, "current_zoho_user_id"))
      .limit(1);
    return fallback?.value ?? null;
  }

  private async lookupLoggedMinutes(taskId: string) {
    const rows = await this.db.db
      .select()
      .from(timesheetLogCacheTable)
      .where(eq(timesheetLogCacheTable.taskId, taskId));
    return rows.reduce((sum, row) => sum + row.durationMinutes, 0);
  }
}
