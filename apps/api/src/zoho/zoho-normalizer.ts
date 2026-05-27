import { Injectable } from "@nestjs/common";
import type {
  IdNamePair,
  TaskRow,
  TimesheetLog,
} from "@zoho-power-grid/shared";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => (value && typeof value === "object" ? (value as UnknownRecord) : {});
const asString = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
const asNullableString = (value: unknown) => {
  const resolved = asString(value);
  return resolved || null;
};
const asZohoBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = asString(value).trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized === "1" || normalized === "true" || normalized === "yes";
};
const parseDurationToMinutes = (value: unknown) => {
  if (typeof value === "number") {
    // Zoho timesheet durations often arrive in milliseconds.
    return value > 10_000 ? Math.round(value / 60_000) : value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  if (!value || value === "-1") {
    return 0;
  }

  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    return numeric > 10_000 ? Math.round(numeric / 60_000) : numeric;
  }

  let minutes = 0;
  const dayMatch = value.match(/(\d+)\s*d/);
  const hourMatch = value.match(/(\d+)\s*h/);
  const minuteMatch = value.match(/(\d+)\s*m/);

  if (dayMatch) {
    minutes += Number(dayMatch[1]) * 24 * 60;
  }
  if (hourMatch) {
    minutes += Number(hourMatch[1]) * 60;
  }
  if (minuteMatch) {
    minutes += Number(minuteMatch[1]);
  }

  return minutes;
};
const asNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const coerceList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>);
  }

  return [];
};

const normalizedRows = (
  payload: unknown,
  idsKey: string,
  rowsKey: string,
  propKey: string,
) => {
  const container = asRecord(payload);
  const ids = coerceList(container[idsKey]).map((id) => asString(id)).filter(Boolean);
  const rows = asRecord(container[rowsKey]);
  const props = asRecord(container[propKey]);
  return ids.map((id) => ({
    id,
    values: Array.isArray(rows[id]) ? (rows[id] as unknown[]) : [],
    props,
    container,
  }));
};

@Injectable()
export class ZohoNormalizer {
  normalizeWorkspaces(payload: unknown): IdNamePair[] {
    const container = asRecord(payload);
    return coerceList(container.portals)
      .map((entry) => {
        const row = asRecord(entry);
        const id = asString(row.zsoid ?? row.teamId ?? row.id);
        const name = asString(row.teamName ?? row.orgName ?? row.name);
        return id && name ? { id, name } : null;
      })
      .filter((row): row is IdNamePair => Boolean(row));
  }

  normalizeIdNameList(payload: unknown, idCandidates: string[], nameCandidates: string[]): IdNamePair[] {
    return coerceList(payload)
      .map((entry) => {
        const row = asRecord(entry);
        const id = idCandidates.map((key) => asString(row[key])).find(Boolean) ?? "";
        const name = nameCandidates.map((key) => asString(row[key])).find(Boolean) ?? "";
        return id && name ? { id, name } : null;
      })
      .filter((row): row is IdNamePair => Boolean(row));
  }

  normalizeProjects(payload: unknown): IdNamePair[] {
    const matrix = normalizedRows(payload, "projectIds", "projectJObj", "project_prop");
    return matrix.flatMap(({ id, values, props }) => {
      const nameIndex = Number(props.projName);
      const name = asString(values[nameIndex]);
      return id && name ? [{ id, name }] : [];
    });
  }

  normalizeSprints(payload: unknown): Array<IdNamePair & { state?: string | null }> {
    const matrix = normalizedRows(payload, "sprintIds", "sprintJObj", "sprint_prop");
    return matrix.flatMap(({ id, values, props }) => {
      const nameIndex = Number(props.sprintName);
      const typeIndex = Number(props.sprintType);
      const name = asString(values[nameIndex]);
      const type = asString(values[typeIndex]);
      const state =
        type === "1"
          ? "upcoming"
          : type === "2"
            ? "active"
            : type === "3"
              ? "completed"
              : type === "4"
                ? "canceled"
                : null;
      return id && name ? [{ id, name, state }] : [];
    });
  }

  normalizeUsers(payload: unknown): Array<IdNamePair & { email?: string | null; iamUserId?: string | null }> {
    const matrix = normalizedRows(payload, "userIds", "userJObj", "user_prop");
    if (!matrix.length) {
      const container = asRecord(payload);
      const rows = asRecord(container.userJObj);
      return Object.entries(rows)
        .map(([id, values]) => {
          const list = Array.isArray(values) ? values : [];
          return {
            id,
            name: asString(list[0]),
            email: asNullableString(list[1]),
            iamUserId: asNullableString(list[3]),
          };
        })
        .filter((row) => row.name);
    }

    return matrix.flatMap(({ id, values, props }) => {
      const name = asString(values[Number(props.name ?? 0)]);
      const email = asNullableString(values[Number(props.email ?? 1)]);
      const iamUserId = asNullableString(values[Number(props.iamUserId ?? 3)]);
      return id && name ? [{ id, name, email, iamUserId }] : [];
    });
  }

  normalizeTags(payload: unknown): Array<IdNamePair & { color?: string | null }> {
    const container = asRecord(payload);
    const rows = asRecord(container.zsTagJObj);
    return Object.entries(rows)
      .map(([id, values]) => {
        const list = Array.isArray(values) ? values : [];
        return {
          id,
          name: asString(list[6]),
          color: asNullableString(list[10]),
        };
      })
      .filter((row) => row.name);
  }

  normalizePriorities(payload: unknown): Array<IdNamePair & { color?: string | null }> {
    const matrix = normalizedRows(payload, "projPriorityIds", "projPriorityJObj", "projPriority_prop");
    return matrix.flatMap(({ id, values, props }) => {
      const name = asString(values[Number(props.priorityName)]);
      const color = asNullableString(values[Number(props.colorCode)]);
      return id && name ? [{ id, name, color }] : [];
    });
  }

  normalizeStatuses(payload: unknown): Array<IdNamePair & { color?: string | null }> {
    const matrix = normalizedRows(payload, "statusIds", "statusJObj", "status_prop");
    return matrix.flatMap(({ id, values, props }) => {
      const name = asString(values[Number(props.statusName)]);
      const color = asNullableString(values[Number(props.colorCode)]);
      return id && name ? [{ id, name, color }] : [];
    });
  }

  normalizeTasks(payload: unknown): TaskRow[] {
    const container = asRecord(payload);
    const matrix = normalizedRows(payload, "itemIds", "itemJObj", "item_prop");
    if (matrix.length) {
      const userDisplayName = asRecord(container.userDisplayName);
      return matrix.flatMap(({ id, values, props }) => {
        const name = asString(values[Number(props.itemName)]);
        const itemNo = asString(values[Number(props.itemNo)]);
        const descriptionIndex = Number(
          props.description ?? props.itemDescription ?? props.itemDesc ?? props.itemInfo,
        );
        const sprintId = asNullableString(values[Number(props.sprintId)]);
        const statusId = asString(values[Number(props.statusId)]);
        const statusNameIndex = Number(props.statusName ?? props.itemStatusName);
        const priorityId = asNullableString(values[Number(props.projPriorityId)]);
        const priorityNameIndex = Number(props.priorityName ?? props.projPriorityName);
        const dueDate = asNullableString(values[Number(props.endDate)]);
        const estimatedMinutes = parseDurationToMinutes(values[Number(props.duration)]) || null;
        const ownerIds = coerceList(values[Number(props.ownerId)]).map((entry) => asString(entry)).filter(Boolean);

        if (!id) {
          return [];
        }

        return [
          {
            id,
            itemNo,
            name,
            description: Number.isFinite(descriptionIndex) ? asNullableString(values[descriptionIndex]) : null,
            workspaceId: "",
            projectId: "",
            projectName: "",
            sprintId,
            sprintName: null,
            statusId,
            statusName: Number.isFinite(statusNameIndex) ? asString(values[statusNameIndex]) : "",
            priorityId,
            priorityName: Number.isFinite(priorityNameIndex)
              ? asNullableString(values[priorityNameIndex])
              : null,
            assigneeIds: ownerIds,
            assigneeNames: ownerIds.map((ownerId) => asString(userDisplayName[ownerId])).filter(Boolean),
            dueDate,
            estimatedMinutes,
            loggedMinutes: 0,
            remainingMinutes: null,
            tagIds: [],
            tagNames: [],
            updatedAt: new Date().toISOString(),
          } satisfies TaskRow,
        ];
      });
    }

    const directRows = coerceList(
      container.items ?? container.itemJObj ?? container.data ?? container.itemdata ?? payload,
    );

    return directRows
      .map((entry) => {
        const row = asRecord(entry);
        const status = asRecord(row.status ?? row.statusobj ?? row.statusJObj);
        const priority = asRecord(row.priority ?? row.priorityobj ?? row.projPriorityJObj);
        const project = asRecord(row.project ?? row.projectJObj);
        const sprint = asRecord(row.sprint ?? row.sprintJObj);
        const users = coerceList(row.users ?? row.userJObj ?? row.assignees);
        const tags = coerceList(row.tags ?? row.tagJObj ?? row.itemassociatedtagIds);

        const assignees = users.map((user) => asRecord(user));
        const normalizedTags = tags.map((tag) => asRecord(tag));
        const id = asString(row.id ?? row.itemid ?? row.itemId);
        if (!id) {
          return null;
        }

        return {
          id,
          itemNo: asString(row.itemno ?? row.itemNo ?? row.key ?? row.itemkey),
          name: asString(row.name ?? row.title),
          description: asNullableString(row.description ?? row.itemDescription ?? row.details),
          workspaceId: asString(row.teamid ?? row.teamId ?? project.teamid ?? project.teamId),
          projectId: asString(row.projectid ?? row.projectId ?? project.id ?? project.projectid),
          projectName: asString(row.projectname ?? row.projectName ?? project.name),
          sprintId: asNullableString(row.sprintid ?? row.sprintId ?? sprint.id ?? sprint.sprintid),
          sprintName: asNullableString(row.sprintname ?? row.sprintName ?? sprint.name),
          statusId: asString(row.statusid ?? row.statusId ?? status.id ?? status.statusid),
          statusName: asString(
            row.statusname ??
              row.statusName ??
              status.statusname ??
              status.statusName ??
              status.name ??
              status.label ??
              status.value,
          ),
          priorityId: asNullableString(row.priorityid ?? row.priorityId ?? priority.id ?? priority.priorityid),
          priorityName: asNullableString(row.priorityname ?? row.priorityName ?? priority.name),
          assigneeIds: assignees.map((user) => asString(user.id ?? user.userid ?? user.userId)).filter(Boolean),
          assigneeNames: assignees.map((user) => asString(user.name ?? user.zsname ?? user.display_name)).filter(Boolean),
          dueDate: asNullableString(row.enddate ?? row.endDate ?? row.duedate ?? row.dueDate),
          estimatedMinutes: parseDurationToMinutes(row.duration ?? row.estimatedhours ?? row.estimateMinutes) || null,
          loggedMinutes: asNumber(row.loghours ?? row.loggedHours ?? row.loggedminutes),
          remainingMinutes: parseDurationToMinutes(row.remaininghours ?? row.remainingMinutes) || null,
          tagIds: normalizedTags.map((tag) => asString(tag.id ?? tag.tagid ?? tag.tagId)).filter(Boolean),
          tagNames: normalizedTags.map((tag) => asString(tag.name)).filter(Boolean),
          updatedAt: new Date().toISOString(),
        } satisfies TaskRow;
      })
      .filter((row): row is TaskRow => Boolean(row));
  }

  normalizeTimesheetLogs(payload: unknown): TimesheetLog[] {
    const container = asRecord(payload);
    const matrix = normalizedRows(payload, "logIds", "logJObj", "log_prop");
    if (matrix.length) {
      return matrix
        .map(({ id, values, props }) => ({
          id,
          taskId: asNullableString(values[Number(props.itemId ?? 8)]),
          projectId: asString(values[Number(props.projectId ?? 32)]),
          projectName: "",
          sprintId: asNullableString(values[Number(props.sprintId ?? 0)]),
          taskName: asNullableString(values[Number(props.itemName ?? 2)]),
          date: asString(values[Number(props.logDate ?? 12)]).slice(0, 10),
          durationMinutes: parseDurationToMinutes(values[Number(props.timeTaken ?? props.duration ?? 13)]),
          notes: asString(values[Number(props.logNotes ?? 18)]),
          billable: asZohoBoolean(values[Number(props.billableType ?? 14)]),
          updatedAt: asString(values[Number(props.lastUpdatedTime ?? 28)]) || new Date().toISOString(),
        }))
        .filter((row): row is TimesheetLog => Boolean(row.id));
    }

    const directRows = coerceList(container.loghours ?? container.logJObj ?? container.data ?? payload);

    return directRows
      .map((entry) => {
        const row = asRecord(entry);
        const id = asString(row.id ?? row.logid ?? row.logId);
        if (!id) {
          return null;
        }

        return {
          id,
          taskId: asNullableString(row.itemid ?? row.taskId),
          projectId: asString(row.projectid ?? row.projectId),
          projectName: asString(row.projectname ?? row.projectName),
          sprintId: asNullableString(row.sprintid ?? row.sprintId),
          taskName: asNullableString(row.itemname ?? row.taskName ?? row.logtitle),
          date: asString(row.date).slice(0, 10),
          durationMinutes: parseDurationToMinutes(row.duration ?? row.minutes),
          notes: asString(row.notes),
          billable: asZohoBoolean(row.isbillable ?? row.billable),
          updatedAt: new Date().toISOString(),
        } satisfies TimesheetLog;
      })
      .filter((row): row is TimesheetLog => Boolean(row));
  }
}
