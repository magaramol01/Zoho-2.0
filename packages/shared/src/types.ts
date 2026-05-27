export type IdNamePair = {
  id: string;
  name: string;
};

export type TaskRow = {
  id: string;
  itemNo: string;
  name: string;
  description: string | null;
  workspaceId: string;
  projectId: string;
  projectName: string;
  sprintId: string | null;
  sprintName: string | null;
  statusId: string;
  statusName: string;
  priorityId: string | null;
  priorityName: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
  dueDate: string | null;
  estimatedMinutes: number | null;
  loggedMinutes: number;
  remainingMinutes: number | null;
  tagIds: string[];
  tagNames: string[];
  updatedAt: string;
};

export type TaskPatch = Partial<
  Pick<
    TaskRow,
    "name" | "statusId" | "priorityId" | "dueDate" | "estimatedMinutes" | "remainingMinutes"
  >
> & {
  assigneeIds?: string[];
  tagIds?: string[];
};

export type TaskBulkAction =
  | {
      type: "set-status";
      taskIds: string[];
      statusId: string;
    }
  | {
      type: "move-sprint";
      taskIds: string[];
      projectId: string;
      sprintId: string | null;
    }
  | {
      type: "set-priority";
      taskIds: string[];
      priorityId: string | null;
    };

export type TimesheetDraft = {
  taskId?: string;
  projectId: string;
  sprintId?: string;
  date: string;
  durationMinutes: number;
  notes?: string;
  billable: boolean;
};

export type TimesheetLog = {
  id: string;
  taskId: string | null;
  projectId: string;
  projectName: string;
  sprintId: string | null;
  taskName: string | null;
  date: string;
  durationMinutes: number;
  notes: string;
  billable: boolean;
  updatedAt: string;
};

export type SavedView = {
  id: string;
  name: string;
  route: "tasks" | "today" | "timesheet";
  filters: Record<string, string | string[] | null>;
  columns: string[];
  sort: {
    field: string;
    direction: "asc" | "desc";
  }[];
  createdAt: string;
  updatedAt: string;
};

export type DashboardSummary = {
  todayCount: number;
  overdueCount: number;
  inProgressCount: number;
  remainingMinutes: number;
  recentlyUpdated: TaskRow[];
  sprintProgress: Array<{
    sprintId: string;
    sprintName: string;
    projectName: string;
    total: number;
    completed: number;
  }>;
};

export type MetadataBundle = {
  workspaces: IdNamePair[];
  projects: IdNamePair[];
  sprints: Array<IdNamePair & { projectId: string }>;
  statuses: Array<IdNamePair & { projectId?: string }>;
  priorities: Array<IdNamePair & { projectId?: string }>;
  users: IdNamePair[];
  tags: IdNamePair[];
};

export type BootstrapPayload = {
  authenticated: boolean;
  authUrl: string | null;
  currentUser: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  metadata: MetadataBundle;
  savedViews: SavedView[];
  shortcuts: Array<{
    combo: string;
    description: string;
  }>;
};

export type ApiErrorShape = {
  message: string;
  code?: string;
  details?: unknown;
};
