import { jsx as _jsx } from "react/jsx-runtime";
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "./components/layout/app-shell";
import { api } from "./lib/api";
import { DashboardPanel } from "./components/dashboard/dashboard-panel";
import { TaskGrid } from "./components/tasks/task-grid";
import { TimesheetPanel } from "./components/timesheet/timesheet-panel";
import { SettingsPanel } from "./components/settings/settings-panel";
import { useDeferredSearch, useLiveInvalidation } from "./lib/hooks";
import { useEffect, useState } from "react";
import { ShellContext, useShellState } from "./lib/shell-context";
const RootRouteComponent = () => {
    useLiveInvalidation();
    const { search, setSearch, deferredSearch } = useDeferredSearch();
    const [duplicateSignal, setDuplicateSignal] = useState(0);
    const [selectedProjectId, setSelectedProjectId] = useState(() => {
        if (typeof window === "undefined") {
            return null;
        }
        return window.localStorage.getItem("power-grid:selected-project");
    });
    const { data: bootstrap } = useQuery({
        queryKey: ["bootstrap"],
        queryFn: api.bootstrap,
    });
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (selectedProjectId) {
            window.localStorage.setItem("power-grid:selected-project", selectedProjectId);
            return;
        }
        window.localStorage.removeItem("power-grid:selected-project");
    }, [selectedProjectId]);
    if (!bootstrap) {
        return _jsx("div", { className: "p-10 text-sm text-slate-500", children: "Loading workspace shell..." });
    }
    return (_jsx(ShellContext.Provider, { value: {
            search,
            deferredSearch,
            setSearch,
            duplicateSignal,
            selectedProjectId,
            setSelectedProjectId,
        }, children: _jsx(AppShell, { bootstrap: bootstrap, search: search, setSearch: setSearch, selectedProjectId: selectedProjectId, duplicateTimesheetRow: () => setDuplicateSignal((value) => value + 1), children: _jsx(Outlet, {}) }) }));
};
const rootRoute = createRootRoute({
    component: RootRouteComponent,
});
const todayRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/today",
    component: () => {
        const shell = useShellState();
        const { data: bootstrap } = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap });
        return bootstrap ? (_jsx(DashboardPanel, { metadata: bootstrap.metadata, selectedProjectId: shell.selectedProjectId, setSelectedProjectId: shell.setSelectedProjectId })) : null;
    },
});
const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/tasks",
    component: () => {
        const shell = useShellState();
        const { data: bootstrap } = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap });
        return bootstrap ? (_jsx(TaskGrid, { search: shell.deferredSearch, metadata: bootstrap.metadata, selectedProjectId: shell.selectedProjectId })) : null;
    },
});
const timesheetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/timesheet",
    component: () => {
        const shell = useShellState();
        const { data: bootstrap } = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap });
        return bootstrap ? _jsx(TimesheetPanel, { metadata: bootstrap.metadata, duplicateSignal: shell.duplicateSignal }) : null;
    },
});
const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => {
        const { data: bootstrap } = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap });
        return bootstrap ? _jsx(SettingsPanel, { bootstrap: bootstrap }) : null;
    },
});
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    beforeLoad: () => {
        throw redirect({ to: "/today" });
    },
});
const routeTree = rootRoute.addChildren([indexRoute, todayRoute, tasksRoute, timesheetRoute, settingsRoute]);
export const router = createRouter({
    routeTree,
    defaultPreload: "intent",
});
