import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { compactNumber, minutesToDisplay, type MetadataBundle } from "@zoho-power-grid/shared";
import { StatCard, Surface } from "@zoho-power-grid/ui";
import { api } from "../../lib/api";

export const DashboardPanel = ({
  metadata,
  selectedProjectId,
  setSelectedProjectId,
}: {
  metadata: MetadataBundle;
  selectedProjectId: string | null;
  setSelectedProjectId: (value: string | null) => void;
}) => {
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "project-home"],
    queryFn: () => api.tasks({ mine: "false" }),
  });

  const projectSummaries = metadata.projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const sprintCount = new Set(projectTasks.map((task) => task.sprintId).filter(Boolean)).size;
    const loggedMinutes = projectTasks.reduce((sum, task) => sum + task.loggedMinutes, 0);
    const inProgress = projectTasks.filter((task) => task.statusName.toLowerCase().includes("progress")).length;
    const recentSprintNames = Array.from(
      new Set(projectTasks.map((task) => task.sprintName).filter((value): value is string => Boolean(value))),
    ).slice(0, 3);

    return {
      id: project.id,
      name: project.name,
      itemCount: projectTasks.length,
      sprintCount,
      loggedMinutes,
      inProgress,
      recentSprintNames,
    };
  });

  const totalLoggedMinutes = tasks.reduce((sum, task) => sum + task.loggedMinutes, 0);
  const activeProject =
    projectSummaries.find((project) => project.id === selectedProjectId) ??
    projectSummaries.find((project) => project.itemCount > 0) ??
    projectSummaries[0];
  const recentTasks = tasks
    .filter((task) => !activeProject || task.projectId === activeProject.id)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects" value={metadata.projects.length} hint="All Zoho projects available in your workspace." />
        <StatCard label="My Items" value={compactNumber(tasks.length)} hint="Only tasks already assigned to you." />
        <StatCard label="Active Sprints" value={compactNumber(new Set(tasks.map((task) => task.sprintId).filter(Boolean)).size)} hint="Sprint buckets represented across your assigned items." />
        <StatCard label="Logged" value={minutesToDisplay(totalLoggedMinutes)} hint="Total logged time across the visible personal workload." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <Surface
          title="Projects"
          subtitle="Start from a project, then open the sheet view already filtered to your assigned items."
        >
          {metadata.projects.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {projectSummaries.map((project) => {
                const isActive = project.id === activeProject?.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      navigate({ to: "/tasks" });
                    }}
                    className={[
                      "rounded-[1.75rem] border p-5 text-left transition",
                      isActive
                        ? "border-sky-300 bg-sky-50 shadow-[0_20px_60px_rgba(14,165,233,0.16)]"
                        : "border-slate-200 bg-slate-50/90 hover:border-slate-300 hover:bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{project.name}</p>
                        <p className="mt-2 text-sm text-slate-500">
                          {project.itemCount
                            ? `${project.itemCount} assigned item${project.itemCount === 1 ? "" : "s"} ready in your sheet`
                            : "No assigned items cached for you yet"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                        Open sheet
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-white/90 p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Items</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{compactNumber(project.itemCount)}</p>
                      </div>
                      <div className="rounded-2xl bg-white/90 p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Sprints</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{compactNumber(project.sprintCount)}</p>
                      </div>
                      <div className="rounded-2xl bg-white/90 p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Logged</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{minutesToDisplay(project.loggedMinutes)}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {project.recentSprintNames.length ? (
                        project.recentSprintNames.map((sprintName) => (
                          <span key={sprintName} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                            {sprintName}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
                          Sprint names will appear after sync
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              {isLoading ? "Syncing projects from Zoho..." : "No projects found yet. Refresh the connection in Settings and let sync finish."}
            </div>
          )}
        </Surface>

        <div className="space-y-4">
          <Surface
            title={activeProject ? `${activeProject.name} snapshot` : "Project snapshot"}
            subtitle="Quick read before you jump into the sheet."
          >
            {activeProject ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Assigned items</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{compactNumber(activeProject.itemCount)}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">In progress</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{compactNumber(activeProject.inProgress)}</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-500">
                  Open the sheet to work with item ID, status, item name, description, sprint name, and logged hours in one fast table.
                </p>
              </div>
            ) : (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                Pick a project to anchor the sheet view.
              </p>
            )}
          </Surface>

          <Surface title="Recent assigned items" subtitle="Latest rows from the currently selected project context.">
            <div className="space-y-3">
              {recentTasks.length ? (
                recentTasks.map((task) => (
                  <div key={task.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{task.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {task.statusName} • {task.sprintName ?? "Backlog"}
                        </p>
                      </div>
                      <span className="text-sm text-slate-500">{task.itemNo}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                  Assigned items will appear here as soon as task sync completes.
                </p>
              )}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
};
