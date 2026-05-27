import {
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
} from "@ag-grid-community/core";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import { AgGridReact } from "@ag-grid-community/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { MetadataBundle, TaskBulkAction, TaskPatch, TaskRow } from "@zoho-power-grid/shared";
import { minutesToDisplay } from "@zoho-power-grid/shared";
import { Button, GhostButton, Surface } from "@zoho-power-grid/ui";
import { useMemo, useState } from "react";
import { api } from "../../lib/api";

ModuleRegistry.registerModules([ClientSideRowModelModule]);

export const TaskGrid = ({
  search,
  metadata,
  selectedProjectId,
}: {
  search: string;
  metadata: MetadataBundle;
  selectedProjectId: string | null;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [scope, setScope] = useState<"mine" | "project">("mine");
  const selectedProject = metadata.projects.find((project) => project.id === selectedProjectId) ?? null;
  const projectStatuses = metadata.statuses.filter((status) => !selectedProjectId || status.projectId === selectedProjectId);
  const projectPriorities = metadata.priorities.filter(
    (priority) => !selectedProjectId || priority.projectId === selectedProjectId,
  );
  const { data = [], isLoading } = useQuery({
    queryKey: ["tasks", selectedProjectId, search, scope],
    queryFn: () =>
      api.tasks({
        projectId: selectedProjectId,
        search,
        mine: scope === "project" ? "false" : "true",
      }),
    enabled: Boolean(selectedProjectId),
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: TaskPatch }) => api.updateTask(taskId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: (action: TaskBulkAction) => api.bulkUpdateTasks(action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const statusValues = projectStatuses.map((status) => status.id);
  const priorityValues = projectPriorities.map((priority) => priority.id);

  const columns = useMemo<ColDef<TaskRow>[]>(
    () => [
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
        valueFormatter: (params) =>
          projectStatuses.find((status) => status.id === params.value)?.name ?? params.data?.statusName ?? params.value,
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
    ],
    [projectStatuses, statusValues],
  );

  const onCellValueChanged = (event: CellValueChangedEvent<TaskRow>) => {
    const patch: TaskPatch = {};
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
    return (
      <Surface
        title="Project sheet"
        subtitle="Choose a project first, then this screen becomes your spreadsheet-style working table."
      >
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg font-medium text-slate-900">No project selected</p>
          <p className="mt-3 text-sm text-slate-500">
            Start from the Projects page so the sheet opens with the correct project and only your assigned items.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/today" })}>
            Open projects
          </Button>
        </div>
      </Surface>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-13rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Surface
        title={selectedProject ? `${selectedProject.name} sheet` : "Project sheet"}
        subtitle="Google-Sheets-style workspace for your assigned items only."
        actions={
          selectedTaskIds.length ? (
            <div className="flex gap-2">
              <GhostButton
                onClick={() =>
                  bulkUpdate.mutate({
                    type: "set-status",
                    taskIds: selectedTaskIds,
                    statusId: projectStatuses[0]?.id ?? "",
                  })
                }
              >
                Set first status
              </GhostButton>
              <GhostButton
                onClick={() =>
                  bulkUpdate.mutate({
                    type: "set-priority",
                    taskIds: selectedTaskIds,
                    priorityId: projectPriorities[0]?.id ?? null,
                  })
                }
                disabled={!projectPriorities.length}
              >
                Bulk priority
              </GhostButton>
            </div>
          ) : null
        }
      >
        <div className="mb-4 grid gap-3 rounded-[1.5rem] bg-slate-50 p-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Rows</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{data.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Selected</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedTaskIds.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Visible logged</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {minutesToDisplay(data.reduce((sum, task) => sum + task.loggedMinutes, 0))}
            </p>
          </div>
        </div>

        <div className="ag-theme-quartz h-[68vh] w-full overflow-hidden rounded-[1.5rem] border border-slate-200">
          {data.length || isLoading ? (
            <AgGridReact<TaskRow>
              rowData={data}
              columnDefs={columns}
              loading={isLoading}
              animateRows
              rowHeight={54}
              rowSelection="multiple"
              suppressRowClickSelection
              onCellValueChanged={onCellValueChanged}
              onSelectionChanged={(event) => setSelectedTaskIds(event.api.getSelectedRows().map((row) => row.id))}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-lg font-medium text-slate-900">
                {scope === "mine" ? "No items assigned to this connected Zoho user" : "No project items available"}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                {scope === "mine"
                  ? "The current OAuth connection appears to map to a shared Zoho account with no directly assigned items in this project. You can still open the full project sheet below."
                  : "Zoho did not return any visible items for this project yet. Try another project or let the sync run again."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {scope === "mine" ? (
                  <Button onClick={() => setScope("project")}>Show project items</Button>
                ) : (
                  <GhostButton onClick={() => setScope("mine")}>Back to my items</GhostButton>
                )}
                <GhostButton onClick={() => navigate({ to: "/today" })}>Choose another project</GhostButton>
              </div>
            </div>
          )}
        </div>
      </Surface>

      <Surface title="Working notes" subtitle="Keep the sheet narrow, fast, and focused.">
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Current scope</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {scope === "mine"
                ? `This sheet is filtered to items from ${selectedProject?.name} that are assigned to the connected Zoho user.`
                : `This sheet is showing the broader ${selectedProject?.name} project view because no direct personal items were matched.`}
            </p>
          </div>
          <div className="rounded-3xl bg-sky-50 p-4">
            <p className="text-sm font-medium text-sky-900">Primary columns</p>
            <p className="mt-2 text-sm leading-6 text-sky-800">
              Item ID, status, item name, description, sprint, and logged hours are kept visible for daily updates.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-800">Fast actions</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Click any cell to edit status or name inline. Use multi-select to push the same status across several rows.
            </p>
          </div>
        </div>
      </Surface>
    </div>
  );
};
