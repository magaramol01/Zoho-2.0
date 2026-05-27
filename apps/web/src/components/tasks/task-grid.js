import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ModuleRegistry, } from "@ag-grid-community/core";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import { AgGridReact } from "@ag-grid-community/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { minutesToDisplay } from "@zoho-power-grid/shared";
import { Button, GhostButton, Surface } from "@zoho-power-grid/ui";
import { useMemo, useState } from "react";
import { api } from "../../lib/api";
ModuleRegistry.registerModules([ClientSideRowModelModule]);
export const TaskGrid = ({ search, metadata, selectedProjectId, }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [scope, setScope] = useState("mine");
    const selectedProject = metadata.projects.find((project) => project.id === selectedProjectId) ?? null;
    const projectStatuses = metadata.statuses.filter((status) => !selectedProjectId || status.projectId === selectedProjectId);
    const projectPriorities = metadata.priorities.filter((priority) => !selectedProjectId || priority.projectId === selectedProjectId);
    const { data = [], isLoading } = useQuery({
        queryKey: ["tasks", selectedProjectId, search, scope],
        queryFn: () => api.tasks({
            projectId: selectedProjectId,
            search,
            mine: scope === "project" ? "false" : "true",
        }),
        enabled: Boolean(selectedProjectId),
    });
    const updateTask = useMutation({
        mutationFn: ({ taskId, patch }) => api.updateTask(taskId, patch),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
    const bulkUpdate = useMutation({
        mutationFn: (action) => api.bulkUpdateTasks(action),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
    const statusValues = projectStatuses.map((status) => status.id);
    const priorityValues = projectPriorities.map((priority) => priority.id);
    const columns = useMemo(() => [
        { checkboxSelection: true, headerCheckboxSelection: true, width: 52, pinned: "left" },
        {
            field: "itemNo",
            headerName: "Item ID",
            width: 120,
            pinned: "left",
            valueFormatter: (params) => params.value || params.data?.id,
        },
        {
            field: "statusId",
            headerName: "Status",
            editable: true,
            width: 170,
            cellEditor: "agSelectCellEditor",
            cellEditorParams: { values: statusValues },
            valueFormatter: (params) => projectStatuses.find((status) => status.id === params.value)?.name ?? params.data?.statusName ?? params.value,
        },
        { field: "name", headerName: "Item Name", flex: 1.2, minWidth: 220, editable: true },
        {
            field: "description",
            headerName: "Description",
            flex: 1.5,
            minWidth: 260,
            wrapText: true,
            autoHeight: true,
            valueFormatter: (params) => params.value ?? "",
        },
        {
            field: "sprintName",
            headerName: "Sprint",
            width: 190,
            valueFormatter: (params) => params.value ?? "Backlog",
        },
        {
            field: "loggedMinutes",
            headerName: "Logged Hours",
            width: 150,
            valueFormatter: (params) => minutesToDisplay(params.value),
        },
    ], [projectStatuses, statusValues]);
    const onCellValueChanged = (event) => {
        const patch = {};
        if (event.colDef.field === "name") {
            patch.name = event.newValue;
        }
        if (event.colDef.field === "statusId") {
            patch.statusId = event.newValue;
        }
        if (Object.keys(patch).length) {
            updateTask.mutate({ taskId: event.data.id, patch });
        }
    };
    if (!selectedProjectId) {
        return (_jsx(Surface, { title: "Project sheet", subtitle: "Choose a project first, then this screen becomes your spreadsheet-style working table.", children: _jsxs("div", { className: "rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center", children: [_jsx("p", { className: "text-lg font-medium text-slate-900", children: "No project selected" }), _jsx("p", { className: "mt-3 text-sm text-slate-500", children: "Start from the Projects page so the sheet opens with the correct project and only your assigned items." }), _jsx(Button, { className: "mt-6", onClick: () => navigate({ to: "/today" }), children: "Open projects" })] }) }));
    }
    return (_jsxs("div", { className: "grid min-h-[calc(100vh-13rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]", children: [_jsxs(Surface, { title: selectedProject ? `${selectedProject.name} sheet` : "Project sheet", subtitle: "Google-Sheets-style workspace for your assigned items only.", actions: selectedTaskIds.length ? (_jsxs("div", { className: "flex gap-2", children: [_jsx(GhostButton, { onClick: () => bulkUpdate.mutate({
                                type: "set-status",
                                taskIds: selectedTaskIds,
                                statusId: projectStatuses[0]?.id ?? "",
                            }), children: "Set first status" }), _jsx(GhostButton, { onClick: () => bulkUpdate.mutate({
                                type: "set-priority",
                                taskIds: selectedTaskIds,
                                priorityId: projectPriorities[0]?.id ?? null,
                            }), disabled: !projectPriorities.length, children: "Bulk priority" })] })) : null, children: [_jsxs("div", { className: "mb-4 grid gap-3 rounded-[1.5rem] bg-slate-50 p-4 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "Rows" }), _jsx("p", { className: "mt-2 text-2xl font-semibold text-slate-900", children: data.length })] }), _jsxs("div", { className: "rounded-2xl bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "Selected" }), _jsx("p", { className: "mt-2 text-2xl font-semibold text-slate-900", children: selectedTaskIds.length })] }), _jsxs("div", { className: "rounded-2xl bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "Visible logged" }), _jsx("p", { className: "mt-2 text-2xl font-semibold text-slate-900", children: minutesToDisplay(data.reduce((sum, task) => sum + task.loggedMinutes, 0)) })] })] }), _jsx("div", { className: "ag-theme-quartz h-[68vh] w-full overflow-hidden rounded-[1.5rem] border border-slate-200", children: data.length || isLoading ? (_jsx(AgGridReact, { rowData: data, columnDefs: columns, loading: isLoading, animateRows: true, rowHeight: 54, rowSelection: "multiple", suppressRowClickSelection: true, onCellValueChanged: onCellValueChanged, onSelectionChanged: (event) => setSelectedTaskIds(event.api.getSelectedRows().map((row) => row.id)) })) : (_jsxs("div", { className: "flex h-full flex-col items-center justify-center px-6 text-center", children: [_jsx("p", { className: "text-lg font-medium text-slate-900", children: scope === "mine" ? "No items assigned to this connected Zoho user" : "No project items available" }), _jsx("p", { className: "mt-3 max-w-xl text-sm leading-6 text-slate-500", children: scope === "mine"
                                        ? "The current OAuth connection appears to map to a shared Zoho account with no directly assigned items in this project. You can still open the full project sheet below."
                                        : "Zoho did not return any visible items for this project yet. Try another project or let the sync run again." }), _jsxs("div", { className: "mt-6 flex flex-wrap justify-center gap-3", children: [scope === "mine" ? (_jsx(Button, { onClick: () => setScope("project"), children: "Show project items" })) : (_jsx(GhostButton, { onClick: () => setScope("mine"), children: "Back to my items" })), _jsx(GhostButton, { onClick: () => navigate({ to: "/today" }), children: "Choose another project" })] })] })) })] }), _jsx(Surface, { title: "Working notes", subtitle: "Keep the sheet narrow, fast, and focused.", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [_jsx("p", { className: "text-sm font-medium text-slate-800", children: "Current scope" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-500", children: scope === "mine"
                                        ? `This sheet is filtered to items from ${selectedProject?.name} that are assigned to the connected Zoho user.`
                                        : `This sheet is showing the broader ${selectedProject?.name} project view because no direct personal items were matched.` })] }), _jsxs("div", { className: "rounded-3xl bg-sky-50 p-4", children: [_jsx("p", { className: "text-sm font-medium text-sky-900", children: "Primary columns" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-sky-800", children: "Item ID, status, item name, description, sprint, and logged hours are kept visible for daily updates." })] }), _jsxs("div", { className: "rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200", children: [_jsx("p", { className: "text-sm font-medium text-slate-800", children: "Fast actions" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-500", children: "Click any cell to edit status or name inline. Use multi-select to push the same status across several rows." })] })] }) })] }));
};
