import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  TimesheetAnalyticsDay,
  TimesheetAnalyticsSummary,
  TimesheetAnalyticsWeek,
  TimesheetDraft,
  TimesheetLog,
} from "@zoho-power-grid/shared";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { DatabaseService } from "../db/database.service";
import {
  projectCacheTable,
  taskCacheTable,
  timesheetLogCacheTable,
  userCacheTable,
} from "../db/schema";
import { EventBusService } from "../events/event-bus.service";
import type {
  TimesheetAnalyticsQueryDto,
  TimesheetQueryDto,
  UpdateTimesheetLogDto,
} from "./dto";
import { SyncService } from "../sync/sync.service";
import { ZohoApiClient } from "../zoho/zoho-api.client";
import { ZohoNormalizer } from "../zoho/zoho-normalizer";
import {
  toZohoBooleanFlag,
  toZohoLogDateTime,
  toZohoLogDuration,
} from "../zoho/zoho-timesheet";

type TimesheetLogRow = typeof timesheetLogCacheTable.$inferSelect;
type ProjectMinutesBucket = {
  projectId: string;
  projectName: string;
  durationMinutes: number;
};

const DEFAULT_ANALYTICS_WEEKS = 12;
const EXPECTED_MINUTES_PER_WORKDAY = 8 * 60;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const asRecord = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

const asNullableString = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") {
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  return null;
};

const parseStoredRawJson = (rawJson: string | null) => {
  if (!rawJson) {
    return {};
  }

  try {
    return asRecord(JSON.parse(rawJson));
  } catch {
    return {};
  }
};

const resolveOwnerFromRawJson = (rawJson: string | null) => {
  const payload = parseStoredRawJson(rawJson);
  return {
    userId: asNullableString(
      payload.userId ??
        payload.userid ??
        payload.user_id ??
        payload.ownerId ??
        payload.ownerid ??
        payload.logOwnerId ??
        payload.logownerid,
    ),
    userName: asNullableString(
      payload.userName ??
        payload.username ??
        payload.user_name ??
        payload.ownerName ??
        payload.ownername ??
        payload.logOwnerName ??
        payload.logownername,
    ),
  };
};

const buildStoredRawJson = (
  rawJson: string | null,
  patch: Partial<TimesheetLog>,
) => {
  const parsed = parseStoredRawJson(rawJson);
  return JSON.stringify({
    ...parsed,
    ...patch,
  });
};

const getIsoWeekNumber = (date: Date) => {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
};

const startOfIsoWeek = (date: Date) => {
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const getLocalIsoDate = () => {
  const local = new Date();
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDate = (date: Date) => {
  const day = date.getUTCDate();
  const month = MONTH_LABELS[date.getUTCMonth()] ?? "";
  return `${day} ${month}`;
};

@Injectable()
export class TimesheetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly zohoApiClient: ZohoApiClient,
    private readonly zohoNormalizer: ZohoNormalizer,
    private readonly syncService: SyncService,
    private readonly eventBus: EventBusService,
  ) {}

  async listLogs(userId: string, query: TimesheetQueryDto): Promise<TimesheetLog[]> {
    await this.syncLogsIfStale(userId, query);

    const [rows, userNameLookup, projectNameLookup] = await Promise.all([
      query.taskId
        ? this.db.db
            .select()
            .from(timesheetLogCacheTable)
            .where(and(eq(timesheetLogCacheTable.taskId, query.taskId), eq(timesheetLogCacheTable.ownerId, userId)))
            .orderBy(
              desc(timesheetLogCacheTable.date),
              desc(timesheetLogCacheTable.updatedAt),
            )
        : query.projectId
          ? this.db.db
              .select()
              .from(timesheetLogCacheTable)
              .where(and(eq(timesheetLogCacheTable.projectId, query.projectId), eq(timesheetLogCacheTable.ownerId, userId)))
              .orderBy(
                desc(timesheetLogCacheTable.date),
                desc(timesheetLogCacheTable.updatedAt),
              )
          : this.db.db
              .select()
              .from(timesheetLogCacheTable)
              .where(eq(timesheetLogCacheTable.ownerId, userId))
              .orderBy(
                desc(timesheetLogCacheTable.date),
                desc(timesheetLogCacheTable.updatedAt),
              ),
      this.getUserNameLookup(userId),
      this.getProjectNameLookup(userId),
    ]);

    return rows.map((row) =>
      this.mapLogRow(row, userNameLookup, projectNameLookup),
    );
  }

  async getAnalytics(
    userId: string,
    query: TimesheetAnalyticsQueryDto,
  ): Promise<TimesheetAnalyticsSummary> {
    await this.syncLogsIfStale(userId, {});

    const [
      rows,
      userNameLookup,
      projectNameLookup,
      currentInternalUserId,
      currentInternalUserName,
      currentZohoUserId,
      currentZohoUserName,
    ] = await Promise.all([
      this.db.db
        .select()
        .from(timesheetLogCacheTable)
        .where(eq(timesheetLogCacheTable.ownerId, userId))
        .orderBy(desc(timesheetLogCacheTable.date), desc(timesheetLogCacheTable.updatedAt)),
      this.getUserNameLookup(userId),
      this.getProjectNameLookup(userId),
      this.syncService.getSyncValue(userId, "current_zoho_internal_user_id"),
      this.syncService.getSyncValue(userId, "current_zoho_internal_user_name"),
      this.syncService.getSyncValue(userId, "current_zoho_user_id"),
      this.syncService.getSyncValue(userId, "current_zoho_user_name"),
    ]);

    const selectedWeekCount = Math.min(
      Math.max(query.weeks ?? DEFAULT_ANALYTICS_WEEKS, 1),
      26,
    );
    const selectedUserId =
      query.userId?.trim() ||
      currentInternalUserId ||
      currentZohoUserId ||
      null;
    const selectedUserName =
      (selectedUserId ? userNameLookup.get(selectedUserId) : null) ||
      (selectedUserId === currentInternalUserId
        ? currentInternalUserName
        : null) ||
      (selectedUserId === currentZohoUserId ? currentZohoUserName : null) ||
      null;
    const includeUnknownOwnerLogs = Boolean(selectedUserId) &&
      (selectedUserId === currentInternalUserId ||
        selectedUserId === currentZohoUserId);

    const today = parseIsoDate(getLocalIsoDate());
    const currentWeekStart = startOfIsoWeek(today);
    const earliestWeekStart = addDays(
      currentWeekStart,
      -7 * (selectedWeekCount - 1),
    );
    const earliestDate = toIsoDate(earliestWeekStart);
    const latestDate = toIsoDate(addDays(currentWeekStart, 6));

    const logsInRange = rows
      .map((row) => this.mapLogRow(row, userNameLookup, projectNameLookup))
      .filter((row) => row.date >= earliestDate && row.date <= latestDate);

    const logsWithoutOwner = logsInRange.filter((row) => !row.userId);
    const matchedLogs = selectedUserId
      ? logsInRange.filter((row) => row.userId === selectedUserId)
      : logsInRange;
    const selectedLogs =
      selectedUserId && includeUnknownOwnerLogs
        ? [...matchedLogs, ...logsWithoutOwner]
        : matchedLogs;

    const dailyBuckets = new Map<
      string,
      {
        loggedMinutes: number;
        entryCount: number;
        projects: Map<string, ProjectMinutesBucket>;
      }
    >();

    for (const log of selectedLogs) {
      const existing = dailyBuckets.get(log.date) ?? {
        loggedMinutes: 0,
        entryCount: 0,
        projects: new Map<string, ProjectMinutesBucket>(),
      };

      existing.loggedMinutes += log.durationMinutes;
      existing.entryCount += 1;

      const projectBucket =
        existing.projects.get(log.projectId) ??
        ({
          projectId: log.projectId,
          projectName: log.projectName,
          durationMinutes: 0,
        } satisfies ProjectMinutesBucket);
      projectBucket.durationMinutes += log.durationMinutes;
      existing.projects.set(log.projectId, projectBucket);

      dailyBuckets.set(log.date, existing);
    }

    const weeks: TimesheetAnalyticsWeek[] = [];
    const attentionDays: TimesheetAnalyticsDay[] = [];
    const todayIso = getLocalIsoDate();

    for (let weekIndex = 0; weekIndex < selectedWeekCount; weekIndex += 1) {
      const weekStart = addDays(currentWeekStart, -7 * weekIndex);
      const weekEnd = addDays(weekStart, 6);
      const weekDays: TimesheetAnalyticsDay[] = [];

      let loggedMinutes = 0;
      let targetMinutes = 0;
      let missingMinutes = 0;
      let trackedWorkdayCount = 0;
      let filledDays = 0;
      let partialDays = 0;
      let emptyDays = 0;
      let overDays = 0;

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const dayDate = addDays(weekStart, dayIndex);
        const isoDate = toIsoDate(dayDate);
        const weekday = dayDate.getUTCDay();
        const isWeekend = weekday === 0 || weekday === 6;
        const isFuture = isoDate > todayIso;
        const bucket = dailyBuckets.get(isoDate);
        const dayLoggedMinutes = bucket?.loggedMinutes ?? 0;
        const dayTargetMinutes =
          isWeekend || isFuture ? 0 : EXPECTED_MINUTES_PER_WORKDAY;
        const dayMissingMinutes =
          isWeekend || isFuture
            ? 0
            : Math.max(0, EXPECTED_MINUTES_PER_WORKDAY - dayLoggedMinutes);

        let status: TimesheetAnalyticsDay["status"];
        if (isWeekend) {
          status = "weekend";
        } else if (isFuture) {
          status = "upcoming";
        } else if (dayLoggedMinutes > EXPECTED_MINUTES_PER_WORKDAY) {
          status = "over";
        } else if (dayLoggedMinutes === EXPECTED_MINUTES_PER_WORKDAY) {
          status = "filled";
        } else if (dayLoggedMinutes > 0) {
          status = "partial";
        } else {
          status = "empty";
        }

        const day: TimesheetAnalyticsDay = {
          date: isoDate,
          dayLabel: DAY_LABELS[weekday] ?? "",
          isWeekend,
          isFuture,
          loggedMinutes: dayLoggedMinutes,
          targetMinutes: dayTargetMinutes,
          missingMinutes: dayMissingMinutes,
          entryCount: bucket?.entryCount ?? 0,
          projectCount: bucket?.projects.size ?? 0,
          status,
          projects: [...(bucket?.projects.values() ?? [])].sort(
            (left, right) => right.durationMinutes - left.durationMinutes,
          ),
        };

        if (!isWeekend && !isFuture) {
          trackedWorkdayCount += 1;
          targetMinutes += EXPECTED_MINUTES_PER_WORKDAY;
          missingMinutes += dayMissingMinutes;

          if (status === "filled") {
            filledDays += 1;
          } else if (status === "partial") {
            partialDays += 1;
          } else if (status === "empty") {
            emptyDays += 1;
          } else if (status === "over") {
            overDays += 1;
          }

          if (dayMissingMinutes > 0) {
            attentionDays.push(day);
          }
        }

        loggedMinutes += dayLoggedMinutes;
        weekDays.push(day);
      }

      weeks.push({
        weekStart: toIsoDate(weekStart),
        weekEnd: toIsoDate(weekEnd),
        label: `Week ${getIsoWeekNumber(weekStart)} · ${formatShortDate(
          weekStart,
        )} - ${formatShortDate(weekEnd)}`,
        loggedMinutes,
        targetMinutes,
        missingMinutes,
        trackedWorkdayCount,
        filledDays,
        partialDays,
        emptyDays,
        overDays,
        days: weekDays,
      });
    }

    attentionDays.sort((left, right) => right.date.localeCompare(left.date));

    return {
      userId: selectedUserId,
      userName: selectedUserName,
      generatedAt: new Date().toISOString(),
      expectedMinutesPerWorkday: EXPECTED_MINUTES_PER_WORKDAY,
      selectedWeekCount,
      matchedLogCount: selectedLogs.length,
      logsWithoutOwnerCount: logsWithoutOwner.length,
      includedUnknownOwnerLogs: includeUnknownOwnerLogs,
      totalLoggedMinutes: selectedLogs.reduce(
        (sum, log) => sum + log.durationMinutes,
        0,
      ),
      attentionDays,
      weeks,
    };
  }

  private async syncLogsIfStale(userId: string, query: TimesheetQueryDto) {
    if (!(await this.zohoApiClient.canUseZoho(userId))) {
      return;
    }

    await this.syncService.syncMetadata(userId);

    const [latestRow, userNameLookup] = await Promise.all([
      this.db.db
        .select()
        .from(timesheetLogCacheTable)
        .where(eq(timesheetLogCacheTable.ownerId, userId))
        .orderBy(desc(timesheetLogCacheTable.syncedAt))
        .limit(1)
        .then((rows) => rows[0]),
      this.getUserNameLookup(userId),
    ]);

    if (
      latestRow &&
      Date.now() - new Date(latestRow.syncedAt).getTime() < 60_000
    ) {
      return;
    }

    const projects = query.projectId
      ? await this.db.db
          .select()
          .from(projectCacheTable)
          .where(and(eq(projectCacheTable.id, query.projectId), eq(projectCacheTable.ownerId, userId)))
      : await this.db.db.select().from(projectCacheTable).where(eq(projectCacheTable.ownerId, userId));

    for (const project of projects) {
      try {
        const payload = await this.zohoApiClient.request<unknown>(userId, {
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
          const userName =
            log.userName ||
            (log.userId ? userNameLookup.get(log.userId) ?? null : null);

          await this.db.db
            .insert(timesheetLogCacheTable)
            .values({
              id: log.id,
              ownerId: userId,
              taskId: log.taskId,
              projectId: log.projectId || project.id,
              projectName: log.projectName || project.name,
              sprintId: log.sprintId,
              taskName: log.taskName,
              date: log.date,
              durationMinutes: log.durationMinutes,
              notes: log.notes,
              userId: log.userId,
              userName,
              billable: log.billable,
              rawJson: JSON.stringify(log),
              syncedAt,
            })
            .onConflictDoUpdate({
              target: [timesheetLogCacheTable.id, timesheetLogCacheTable.ownerId],
              set: {
                taskId: log.taskId,
                projectId: log.projectId || project.id,
                projectName: log.projectName || project.name,
                sprintId: log.sprintId,
                taskName: log.taskName,
                date: log.date,
                durationMinutes: log.durationMinutes,
                notes: log.notes,
                userId: log.userId,
                userName,
                billable: log.billable,
                rawJson: JSON.stringify(log),
                syncedAt,
                updatedAt: syncedAt,
              },
            });
        }
      } catch (error) {
        console.warn(`[TimesheetService] Failed to sync timesheets for project ${project.id} user ${userId}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  async createLogs(userId: string, logs: TimesheetDraft[]) {
    for (const draft of logs) {
      let id = nanoid();
      let taskName: string | null = null;
      let projectName = "Unknown project";
      let workspaceId: string | null = null;
      let zohoResponse: unknown = null;
      const resolvedUser = await this.resolveLogUserContext(userId, draft.userId);

      if (draft.taskId) {
        const [task] = await this.db.db
          .select()
          .from(taskCacheTable)
          .where(and(eq(taskCacheTable.id, draft.taskId), eq(taskCacheTable.ownerId, userId)))
          .limit(1);
        if (task) {
          taskName = task.name;
          projectName = task.projectName;
          workspaceId = task.workspaceId;
          await this.db.db
            .update(taskCacheTable)
            .set({
              loggedMinutes: task.loggedMinutes + draft.durationMinutes,
              remainingMinutes:
                task.remainingMinutes === null
                  ? null
                  : Math.max(0, task.remainingMinutes - draft.durationMinutes),
              updatedAt: new Date().toISOString(),
            })
            .where(and(eq(taskCacheTable.id, task.id), eq(taskCacheTable.ownerId, userId)));
        }
      }

      if ((await this.zohoApiClient.canUseZoho(userId)) && workspaceId) {
        if (draft.taskId && draft.sprintId) {
          zohoResponse = await this.zohoApiClient.request(userId, {
            path: `/zsapi/team/${workspaceId}/projects/${draft.projectId}/sprints/${draft.sprintId}/item/${draft.taskId}/timesheet/`,
            method: "POST",
            query: {
              action: "additemlog",
              duration: toZohoLogDuration(draft.durationMinutes),
              date: toZohoLogDateTime(draft.date),
              notes: draft.notes ?? "",
              users: resolvedUser.userId ?? "",
              isbillable: toZohoBooleanFlag(draft.billable),
            },
          });
        } else {
          zohoResponse = await this.zohoApiClient.request(userId, {
            path: `/zsapi/team/${workspaceId}/projects/${draft.projectId}/loghours/`,
            method: "POST",
            query: {
              logtitle: draft.notes?.slice(0, 80) || "Quick log",
              duration: toZohoLogDuration(draft.durationMinutes),
              date: toZohoLogDateTime(draft.date),
              notes: draft.notes ?? "",
              users: resolvedUser.userId ?? "",
              isbillable: toZohoBooleanFlag(draft.billable),
            },
          });
        }
      }

      const normalizedZohoLog = this.zohoNormalizer
        .normalizeTimesheetLogs(zohoResponse)
        .find((log) => log.id);
      id = normalizedZohoLog?.id ?? id;

      await this.db.db.insert(timesheetLogCacheTable).values({
        id,
        ownerId: userId,
        taskId: draft.taskId ?? null,
        projectId: draft.projectId,
        projectName,
        sprintId: draft.sprintId ?? null,
        taskName,
        date: draft.date,
        durationMinutes: draft.durationMinutes,
        notes: draft.notes ?? "",
        userId: normalizedZohoLog?.userId ?? resolvedUser.userId,
        userName: normalizedZohoLog?.userName ?? resolvedUser.userName,
        billable: draft.billable,
        rawJson: JSON.stringify({
          ...draft,
          userId: normalizedZohoLog?.userId ?? resolvedUser.userId,
          userName: normalizedZohoLog?.userName ?? resolvedUser.userName,
        }),
        syncedAt: new Date().toISOString(),
      });
    }

    this.eventBus.emit({ type: "timesheet-updated", at: new Date().toISOString() });
    return { ok: true, count: logs.length };
  }

  async updateLog(userId: string, logId: string, body: UpdateTimesheetLogDto) {
    const [existing] = await this.db.db
      .select()
      .from(timesheetLogCacheTable)
      .where(and(eq(timesheetLogCacheTable.id, logId), eq(timesheetLogCacheTable.ownerId, userId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Log not found");
    }

    const [project] = await this.db.db
      .select()
      .from(projectCacheTable)
      .where(and(eq(projectCacheTable.id, existing.projectId), eq(projectCacheTable.ownerId, userId)))
      .limit(1);
    const resolvedUser = await this.resolveLogUserContext(
      userId,
      body.userId ?? existing.userId ?? resolveOwnerFromRawJson(existing.rawJson).userId,
    );

    if ((await this.zohoApiClient.canUseZoho(userId)) && project?.workspaceId) {
      await this.zohoApiClient.request(userId, {
        path: `/zsapi/team/${project.workspaceId}/projects/${existing.projectId}/timesheet/${logId}/`,
        method: "POST",
        query: {
          action: "updatelog",
          duration: toZohoLogDuration(body.durationMinutes),
          date: toZohoLogDateTime(body.date),
          notes: body.notes ?? existing.notes,
          users: resolvedUser.userId ?? "",
          isbillable: toZohoBooleanFlag(body.billable ?? existing.billable),
          approvetype: "0",
        },
      });
    }

    const updatedAt = new Date().toISOString();
    await this.db.db
      .update(timesheetLogCacheTable)
      .set({
        date: body.date,
        durationMinutes: body.durationMinutes,
        notes: body.notes ?? existing.notes,
        userId: resolvedUser.userId,
        userName: resolvedUser.userName,
        billable: body.billable ?? existing.billable,
        rawJson: buildStoredRawJson(existing.rawJson, {
          date: body.date,
          durationMinutes: body.durationMinutes,
          notes: body.notes ?? existing.notes,
          userId: resolvedUser.userId,
          userName: resolvedUser.userName,
          billable: body.billable ?? existing.billable,
        }),
        syncedAt: updatedAt,
        updatedAt,
      })
      .where(and(eq(timesheetLogCacheTable.id, logId), eq(timesheetLogCacheTable.ownerId, userId)));

    if (existing.taskId) {
      await this.recalculateTaskLoggedMinutes(userId, existing.taskId);
    }

    this.eventBus.emit({ type: "timesheet-updated", at: updatedAt });

    const [row] = await this.db.db
      .select()
      .from(timesheetLogCacheTable)
      .where(and(eq(timesheetLogCacheTable.id, logId), eq(timesheetLogCacheTable.ownerId, userId)))
      .limit(1);

    const [userNameLookup, projectNameLookup] = await Promise.all([
      this.getUserNameLookup(userId),
      this.getProjectNameLookup(userId),
    ]);

    return this.mapLogRow(row!, userNameLookup, projectNameLookup);
  }

  async deleteLog(userId: string, logId: string) {
    const [existing] = await this.db.db
      .select()
      .from(timesheetLogCacheTable)
      .where(and(eq(timesheetLogCacheTable.id, logId), eq(timesheetLogCacheTable.ownerId, userId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Log not found");
    }

    const [project] = await this.db.db
      .select()
      .from(projectCacheTable)
      .where(and(eq(projectCacheTable.id, existing.projectId), eq(projectCacheTable.ownerId, userId)))
      .limit(1);

    if ((await this.zohoApiClient.canUseZoho(userId)) && project?.workspaceId) {
      try {
        await this.zohoApiClient.request(userId, {
          path: `/zsapi/team/${project.workspaceId}/projects/${existing.projectId}/timesheet/${logId}/`,
          method: "DELETE",
          query: { action: "deletelog" },
        });
      } catch {
        // If Zoho delete fails, still remove from local cache
      }
    }

    await this.db.db
      .delete(timesheetLogCacheTable)
      .where(and(eq(timesheetLogCacheTable.id, logId), eq(timesheetLogCacheTable.ownerId, userId)));

    if (existing.taskId) {
      await this.recalculateTaskLoggedMinutes(userId, existing.taskId);
    }

    const deletedAt = new Date().toISOString();
    this.eventBus.emit({ type: "timesheet-updated", at: deletedAt });

    return { ok: true, deletedAt };
  }

  private async recalculateTaskLoggedMinutes(userId: string, taskId: string) {
    const [task] = await this.db.db
      .select()
      .from(taskCacheTable)
      .where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId)))
      .limit(1);

    if (!task) {
      return;
    }

    const logs = await this.db.db
      .select()
      .from(timesheetLogCacheTable)
      .where(and(eq(timesheetLogCacheTable.taskId, taskId), eq(timesheetLogCacheTable.ownerId, userId)));
    const loggedMinutes = logs.reduce(
      (sum, row) => sum + row.durationMinutes,
      0,
    );

    await this.db.db
      .update(taskCacheTable)
      .set({
        loggedMinutes,
        remainingMinutes:
          task.estimatedMinutes === null
            ? null
            : Math.max(0, task.estimatedMinutes - loggedMinutes),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(taskCacheTable.id, taskId), eq(taskCacheTable.ownerId, userId)));
  }

  private mapLogRow(
    row: TimesheetLogRow,
    userNameLookup: Map<string, string>,
    projectNameLookup: Map<string, string>,
  ): TimesheetLog {
    const rawOwner = resolveOwnerFromRawJson(row.rawJson);
    const userId = row.userId ?? rawOwner.userId;
    const userName =
      row.userName ??
      rawOwner.userName ??
      (userId ? userNameLookup.get(userId) ?? null : null);

    return {
      id: row.id,
      taskId: row.taskId,
      projectId: row.projectId,
      projectName:
        row.projectName || projectNameLookup.get(row.projectId) || row.projectId,
      sprintId: row.sprintId,
      taskName: row.taskName,
      date: row.date,
      durationMinutes: row.durationMinutes,
      notes: row.notes,
      userId,
      userName,
      billable: row.billable,
      updatedAt: row.updatedAt,
    };
  }

  private async getUserNameLookup(userId: string) {
    const users = await this.db.db.select().from(userCacheTable).where(eq(userCacheTable.ownerId, userId));
    return new Map(users.map((row) => [row.id, row.name]));
  }

  private async getProjectNameLookup(userId: string) {
    const projects = await this.db.db.select().from(projectCacheTable).where(eq(projectCacheTable.ownerId, userId));
    return new Map(projects.map((row) => [row.id, row.name]));
  }

  private async resolveLogUserContext(userId: string, preferredUserId?: string | null) {
    const [
      fallbackUser,
      userNameLookup,
      currentInternalUserId,
      currentInternalUserName,
      currentZohoUserId,
      currentZohoUserName,
    ] =
      await Promise.all([
        this.db.db.select().from(userCacheTable).where(eq(userCacheTable.ownerId, userId)).limit(1).then((rows) => rows[0] ?? null),
        this.getUserNameLookup(userId),
        this.syncService.getSyncValue(userId, "current_zoho_internal_user_id"),
        this.syncService.getSyncValue(userId, "current_zoho_internal_user_name"),
        this.syncService.getSyncValue(userId, "current_zoho_user_id"),
        this.syncService.getSyncValue(userId, "current_zoho_user_name"),
      ]);

    const resolvedUserId =
      preferredUserId?.trim() ||
      currentInternalUserId ||
      currentZohoUserId ||
      fallbackUser?.id ||
      null;

    return {
      userId: resolvedUserId,
      userName:
        (resolvedUserId ? userNameLookup.get(resolvedUserId) : null) ||
        (resolvedUserId === currentInternalUserId ? currentInternalUserName : null) ||
        (resolvedUserId === currentZohoUserId ? currentZohoUserName : null) ||
        (!resolvedUserId || resolvedUserId === fallbackUser?.id ? fallbackUser?.name ?? null : null) ||
        null,
    };
  }
}
