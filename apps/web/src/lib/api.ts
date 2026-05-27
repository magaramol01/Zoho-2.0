import type {
  BootstrapPayload,
  DashboardSummary,
  MetadataBundle,
  SavedView,
  TaskBulkAction,
  TaskPatch,
  TaskRow,
  TimesheetDraft,
  TimesheetLog,
} from "@zoho-power-grid/shared";

const json = async <T>(input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return (await response.json()) as T;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export const api = {
  bootstrap: () => json<BootstrapPayload>(`${apiBase}/bootstrap`),
  metadata: () => json<MetadataBundle>(`${apiBase}/metadata`),
  dashboard: () => json<DashboardSummary>(`${apiBase}/dashboard`),
  tasks: (query?: Record<string, string | null>) => {
    const url = new URL(`${apiBase}/tasks`);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    return json<TaskRow[]>(url);
  },
  updateTask: (taskId: string, patch: TaskPatch) =>
    json<TaskRow>(`${apiBase}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  bulkUpdateTasks: (body: TaskBulkAction) =>
    json<{ ok: boolean; count: number; tasks: TaskRow[] }>(`${apiBase}/tasks/bulk`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listTimesheet: (projectId?: string) => {
    const url = new URL(`${apiBase}/timesheet`);
    if (projectId) {
      url.searchParams.set("projectId", projectId);
    }
    return json<TimesheetLog[]>(url);
  },
  bulkCreateTimesheet: (logs: TimesheetDraft[]) =>
    json<{ ok: boolean; count: number }>(`${apiBase}/timesheet/bulk`, {
      method: "POST",
      body: JSON.stringify({ logs }),
    }),
  savedViews: () => json<SavedView[]>(`${apiBase}/views`),
  createView: (view: Omit<SavedView, "id" | "createdAt" | "updatedAt">) =>
    json<SavedView[]>(`${apiBase}/views`, {
      method: "POST",
      body: JSON.stringify(view),
    }),
};
