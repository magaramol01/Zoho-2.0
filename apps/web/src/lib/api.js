const json = async (input, init) => {
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
    return (await response.json());
};
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
export const api = {
    bootstrap: () => json(`${apiBase}/bootstrap`),
    metadata: () => json(`${apiBase}/metadata`),
    dashboard: () => json(`${apiBase}/dashboard`),
    tasks: (query) => {
        const url = new URL(`${apiBase}/tasks`);
        Object.entries(query ?? {}).forEach(([key, value]) => {
            if (value) {
                url.searchParams.set(key, value);
            }
        });
        return json(url);
    },
    updateTask: (taskId, patch) => json(`${apiBase}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    }),
    bulkUpdateTasks: (body) => json(`${apiBase}/tasks/bulk`, {
        method: "POST",
        body: JSON.stringify(body),
    }),
    listTimesheet: (projectId) => {
        const url = new URL(`${apiBase}/timesheet`);
        if (projectId) {
            url.searchParams.set("projectId", projectId);
        }
        return json(url);
    },
    bulkCreateTimesheet: (logs) => json(`${apiBase}/timesheet/bulk`, {
        method: "POST",
        body: JSON.stringify({ logs }),
    }),
    savedViews: () => json(`${apiBase}/views`),
    createView: (view) => json(`${apiBase}/views`, {
        method: "POST",
        body: JSON.stringify(view),
    }),
};
