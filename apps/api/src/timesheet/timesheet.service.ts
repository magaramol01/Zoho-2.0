import { Injectable } from "@nestjs/common";
import type { TimesheetDraft, TimesheetLog } from "@zoho-power-grid/shared";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { DatabaseService } from "../db/database.service";
import { projectCacheTable, taskCacheTable, timesheetLogCacheTable, userCacheTable } from "../db/schema";
import { EventBusService } from "../events/event-bus.service";
import type { TimesheetQueryDto } from "./dto";
import { SyncService } from "../sync/sync.service";
import { ZohoApiClient } from "../zoho/zoho-api.client";
import { ZohoNormalizer } from "../zoho/zoho-normalizer";

@Injectable()
export class TimesheetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eventBus: EventBusService,
    private readonly zohoApiClient: ZohoApiClient,
    private readonly zohoNormalizer: ZohoNormalizer,
    private readonly syncService: SyncService,
  ) {}

  async listLogs(query: TimesheetQueryDto): Promise<TimesheetLog[]> {
    await this.syncLogsIfStale(query);

    const rows = query.projectId
      ? await this.db.db
          .select()
          .from(timesheetLogCacheTable)
          .where(eq(timesheetLogCacheTable.projectId, query.projectId))
          .orderBy(desc(timesheetLogCacheTable.date), desc(timesheetLogCacheTable.updatedAt))
      : await this.db.db
          .select()
          .from(timesheetLogCacheTable)
          .orderBy(desc(timesheetLogCacheTable.date), desc(timesheetLogCacheTable.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      projectId: row.projectId,
      projectName: row.projectName,
      sprintId: row.sprintId,
      taskName: row.taskName,
      date: row.date,
      durationMinutes: row.durationMinutes,
      notes: row.notes,
      billable: row.billable,
      updatedAt: row.updatedAt,
    }));
  }

  private async syncLogsIfStale(query: TimesheetQueryDto) {
    if (!(await this.zohoApiClient.canUseZoho())) {
      return;
    }

    await this.syncService.syncMetadata();

    const [latestRow] = await this.db.db.select().from(timesheetLogCacheTable).orderBy(desc(timesheetLogCacheTable.syncedAt)).limit(1);
    if (latestRow && Date.now() - new Date(latestRow.syncedAt).getTime() < 60_000) {
      return;
    }

    const projects = query.projectId
      ? await this.db.db.select().from(projectCacheTable).where(eq(projectCacheTable.id, query.projectId))
      : await this.db.db.select().from(projectCacheTable);

    for (const project of projects) {
      const payload = await this.zohoApiClient.request<unknown>({
        path: `/zsapi/team/${project.workspaceId}/projects/${project.id}/timesheet/`,
        query: {
          action: "data",
          index: 1,
          range: 100,
        },
      });

      const logs = this.zohoNormalizer.normalizeTimesheetLogs(payload);
      const syncedAt = new Date().toISOString();
      for (const log of logs) {
        await this.db.db.insert(timesheetLogCacheTable).values({
          id: log.id,
          taskId: log.taskId,
          projectId: log.projectId || project.id,
          projectName: log.projectName || project.name,
          sprintId: log.sprintId,
          taskName: log.taskName,
          date: log.date,
          durationMinutes: log.durationMinutes,
          notes: log.notes,
          billable: log.billable,
          rawJson: JSON.stringify(log),
          syncedAt,
        }).onConflictDoUpdate({
          target: timesheetLogCacheTable.id,
          set: {
            taskId: log.taskId,
            projectId: log.projectId || project.id,
            projectName: log.projectName || project.name,
            sprintId: log.sprintId,
            taskName: log.taskName,
            date: log.date,
            durationMinutes: log.durationMinutes,
            notes: log.notes,
            billable: log.billable,
            rawJson: JSON.stringify(log),
            syncedAt,
            updatedAt: syncedAt,
          },
        });
      }
    }
  }

  async createLogs(logs: TimesheetDraft[]) {
    for (const draft of logs) {
      const id = nanoid();
      let taskName: string | null = null;
      let projectName = "Unknown project";
      let workspaceId: string | null = null;
      const [fallbackUser] = await this.db.db.select().from(userCacheTable).limit(1);

      if (draft.taskId) {
        const [task] = await this.db.db.select().from(taskCacheTable).where(eq(taskCacheTable.id, draft.taskId)).limit(1);
        if (task) {
          taskName = task.name;
          projectName = task.projectName;
          workspaceId = task.workspaceId;
          await this.db.db
            .update(taskCacheTable)
            .set({
              loggedMinutes: task.loggedMinutes + draft.durationMinutes,
              remainingMinutes:
                task.remainingMinutes === null ? null : Math.max(0, task.remainingMinutes - draft.durationMinutes),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(taskCacheTable.id, task.id));
        }
      }

      if ((await this.zohoApiClient.canUseZoho()) && workspaceId) {
        if (draft.taskId && draft.sprintId) {
          await this.zohoApiClient.request({
            path: `/zsapi/team/${workspaceId}/projects/${draft.projectId}/sprints/${draft.sprintId}/item/${draft.taskId}/timesheet/`,
            method: "POST",
            query: {
              action: "additemlog",
              duration: draft.durationMinutes,
              date: draft.date,
              notes: draft.notes ?? "",
              users: fallbackUser?.id ?? "",
              isbillable: draft.billable,
            },
          });
        } else {
          await this.zohoApiClient.request({
            path: `/zsapi/team/${workspaceId}/projects/${draft.projectId}/loghours/`,
            method: "POST",
            query: {
              logtitle: draft.notes?.slice(0, 80) || "Quick log",
              duration: draft.durationMinutes,
              date: draft.date,
              notes: draft.notes ?? "",
              users: fallbackUser?.id ?? "",
              isbillable: draft.billable,
            },
          });
        }
      }

      await this.db.db.insert(timesheetLogCacheTable).values({
        id,
        taskId: draft.taskId ?? null,
        projectId: draft.projectId,
        projectName,
        sprintId: draft.sprintId ?? null,
        taskName,
        date: draft.date,
        durationMinutes: draft.durationMinutes,
        notes: draft.notes ?? "",
        billable: draft.billable,
        rawJson: JSON.stringify(draft),
        syncedAt: new Date().toISOString(),
      });
    }

    this.eventBus.emit({ type: "timesheet-updated", at: new Date().toISOString() });
    return { ok: true, count: logs.length };
  }
}
