import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { compactNumber, minutesToDisplay } from "@zoho-power-grid/shared";
import { StatCard, Surface } from "@zoho-power-grid/ui";
import { api } from "../../lib/api";
export const DashboardPanel = ({ metadata, selectedProjectId, setSelectedProjectId, }) => {
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
        const recentSprintNames = Array.from(new Set(projectTasks.map((task) => task.sprintName).filter((value) => Boolean(value)))).slice(0, 3);
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
    const activeProject = projectSummaries.find((project) => project.id === selectedProjectId) ??
        projectSummaries.find((project) => project.itemCount > 0) ??
        projectSummaries[0];
    const recentTasks = tasks
        .filter((task) => !activeProject || task.projectId === activeProject.id)
        .slice(0, 6);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Projects", value: metadata.projects.length, hint: "All Zoho projects available in your workspace." }), _jsx(StatCard, { label: "My Items", value: compactNumber(tasks.length), hint: "Only tasks already assigned to you." }), _jsx(StatCard, { label: "Active Sprints", value: compactNumber(new Set(tasks.map((task) => task.sprintId).filter(Boolean)).size), hint: "Sprint buckets represented across your assigned items." }), _jsx(StatCard, { label: "Logged", value: minutesToDisplay(totalLoggedMinutes), hint: "Total logged time across the visible personal workload." })] }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]", children: [_jsx(Surface, { title: "Projects", subtitle: "Start from a project, then open the sheet view already filtered to your assigned items.", children: metadata.projects.length ? (_jsx("div", { className: "grid gap-4 md:grid-cols-2 2xl:grid-cols-3", children: projectSummaries.map((project) => {
                                const isActive = project.id === activeProject?.id;
                                return (_jsxs("button", { type: "button", onClick: () => {
                                        setSelectedProjectId(project.id);
                                        navigate({ to: "/tasks" });
                                    }, className: [
                                        "rounded-[1.75rem] border p-5 text-left transition",
                                        isActive
                                            ? "border-sky-300 bg-sky-50 shadow-[0_20px_60px_rgba(14,165,233,0.16)]"
                                            : "border-slate-200 bg-slate-50/90 hover:border-slate-300 hover:bg-white",
                                    ].join(" "), children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-semibold text-slate-900", children: project.name }), _jsx("p", { className: "mt-2 text-sm text-slate-500", children: project.itemCount
                                                                ? `${project.itemCount} assigned item${project.itemCount === 1 ? "" : "s"} ready in your sheet`
                                                                : "No assigned items cached for you yet" })] }), _jsx("span", { className: "rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm", children: "Open sheet" })] }), _jsxs("div", { className: "mt-5 grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "rounded-2xl bg-white/90 p-3", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "Items" }), _jsx("p", { className: "mt-2 text-xl font-semibold text-slate-900", children: compactNumber(project.itemCount) })] }), _jsxs("div", { className: "rounded-2xl bg-white/90 p-3", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "Sprints" }), _jsx("p", { className: "mt-2 text-xl font-semibold text-slate-900", children: compactNumber(project.sprintCount) })] }), _jsxs("div", { className: "rounded-2xl bg-white/90 p-3", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "Logged" }), _jsx("p", { className: "mt-2 text-xl font-semibold text-slate-900", children: minutesToDisplay(project.loggedMinutes) })] })] }), _jsx("div", { className: "mt-5 flex flex-wrap gap-2", children: project.recentSprintNames.length ? (project.recentSprintNames.map((sprintName) => (_jsx("span", { className: "rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm", children: sprintName }, sprintName)))) : (_jsx("span", { className: "rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm", children: "Sprint names will appear after sync" })) })] }, project.id));
                            }) })) : (_jsx("div", { className: "rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500", children: isLoading ? "Syncing projects from Zoho..." : "No projects found yet. Refresh the connection in Settings and let sync finish." })) }), _jsxs("div", { className: "space-y-4", children: [_jsx(Surface, { title: activeProject ? `${activeProject.name} snapshot` : "Project snapshot", subtitle: "Quick read before you jump into the sheet.", children: activeProject ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "Assigned items" }), _jsx("p", { className: "mt-2 text-2xl font-semibold text-slate-900", children: compactNumber(activeProject.itemCount) })] }), _jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-slate-400", children: "In progress" }), _jsx("p", { className: "mt-2 text-2xl font-semibold text-slate-900", children: compactNumber(activeProject.inProgress) })] })] }), _jsx("p", { className: "text-sm leading-6 text-slate-500", children: "Open the sheet to work with item ID, status, item name, description, sprint name, and logged hours in one fast table." })] })) : (_jsx("p", { className: "rounded-3xl bg-slate-50 p-4 text-sm text-slate-500", children: "Pick a project to anchor the sheet view." })) }), _jsx(Surface, { title: "Recent assigned items", subtitle: "Latest rows from the currently selected project context.", children: _jsx("div", { className: "space-y-3", children: recentTasks.length ? (recentTasks.map((task) => (_jsx("div", { className: "rounded-3xl bg-slate-50 p-4", children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900", children: task.name }), _jsxs("p", { className: "mt-1 text-sm text-slate-500", children: [task.statusName, " \u2022 ", task.sprintName ?? "Backlog"] })] }), _jsx("span", { className: "text-sm text-slate-500", children: task.itemNo })] }) }, task.id)))) : (_jsx("p", { className: "rounded-3xl bg-slate-50 p-4 text-sm text-slate-500", children: "Assigned items will appear here as soon as task sync completes." })) }) })] })] })] }));
};
