import * as Dialog from "@radix-ui/react-dialog";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import type { BootstrapPayload } from "@zoho-power-grid/shared";
import { Kbd, Pill } from "@zoho-power-grid/ui";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

const navItems = [
  { to: "/today", label: "Projects" },
  { to: "/tasks", label: "Sheet" },
  { to: "/timesheet", label: "Timesheet" },
  { to: "/settings", label: "Settings" },
];

export const AppShell = ({
  bootstrap,
  search,
  setSearch,
  selectedProjectId,
  duplicateTimesheetRow,
  children,
}: {
  bootstrap: BootstrapPayload;
  search: string;
  setSearch: (value: string) => void;
  selectedProjectId: string | null;
  duplicateTimesheetRow?: () => void;
  children?: ReactNode;
}) => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const searchRef = useRef<HTMLInputElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const selectedProject = bootstrap.metadata.projects.find((project) => project.id === selectedProjectId);
  const activeSprintCount = new Set(bootstrap.metadata.sprints.map((sprint) => sprint.id)).size;

  useKeyboardShortcuts({
    navigate,
    openPalette: () => setPaletteOpen(true),
    focusSearch: () => searchRef.current?.focus(),
    duplicateTimesheetRow,
  });

  return (
    <Dialog.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef3fb_100%)] px-4 py-4 md:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1600px] grid-cols-1 gap-4 rounded-[2rem] border border-white/80 bg-white/65 p-4 shadow-[0_35px_120px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col rounded-[1.75rem] bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_58%,_#111827_100%)] px-5 py-6 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-sky-200/70">Power Grid</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Zoho Sprints</h1>
                <p className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-400">
                  Project launcher plus a focused sheet for the items already assigned to you.
                </p>
              </div>
              <Pill>{bootstrap.authenticated ? "Connected" : "Local"}</Pill>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-white/8 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Projects</p>
                <p className="mt-2 text-2xl font-semibold text-white">{bootstrap.metadata.projects.length}</p>
              </div>
              <div className="rounded-3xl border border-white/8 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Sprints</p>
                <p className="mt-2 text-2xl font-semibold text-white">{activeSprintCount}</p>
              </div>
            </div>
            <nav className="mt-8 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "block rounded-2xl px-4 py-3 text-sm transition",
                    pathname === item.to
                      ? "bg-white text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.18)]"
                      : "text-slate-300 hover:bg-white/8 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 rounded-3xl border border-white/8 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected project</p>
              <p className="mt-3 text-base font-medium text-white">
                {selectedProject?.name ?? "Choose a project from Projects"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                The sheet view stays filtered to this project and only your assigned items.
              </p>
            </div>
            <div className="mt-6 space-y-3 rounded-3xl border border-white/8 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortcuts</p>
              {bootstrap.shortcuts.slice(0, 4).map((shortcut) => (
                <div key={shortcut.combo} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                  <span>{shortcut.description}</span>
                  <Kbd>{shortcut.combo}</Kbd>
                </div>
              ))}
            </div>
          </aside>

          <main className="flex min-w-0 flex-col gap-4">
            <header className="rounded-[1.75rem] border border-white/80 bg-white/82 px-5 py-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-700/60">Personal command center</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {selectedProject?.name ?? "Pick a project, then work in a sheet"}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{bootstrap.currentUser?.displayName ?? "Personal power mode"}</span>
                    <span className="text-slate-300">•</span>
                    <span>{bootstrap.metadata.projects.length} projects available</span>
                    <span className="text-slate-300">•</span>
                    <span>{bootstrap.metadata.sprints.length} sprint buckets indexed</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 xl:max-w-2xl">
                  <div className="flex items-center gap-3">
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search my assigned items by task name..."
                      className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-300"
                    />
                    <button
                      type="button"
                      onClick={() => setPaletteOpen(true)}
                      className="rounded-full border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-white shadow-sm"
                    >
                      Palette
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill>{bootstrap.authenticated ? "Zoho live sync" : "Local cache mode"}</Pill>
                    {selectedProject ? <Pill>{selectedProject.name}</Pill> : null}
                  </div>
                </div>
              </div>
            </header>

            {children ?? <Outlet />}
          </main>
        </div>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-[14%] w-[min(640px,92vw)] -translate-x-1/2 rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-slate-900">Command palette</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Quick navigation and workflow hints.
          </Dialog.Description>
          <div className="mt-4 grid gap-3">
            {navItems.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  setPaletteOpen(false);
                  navigate({ to: item.to });
                }}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left hover:bg-sky-50"
              >
                <span className="font-medium text-slate-800">{item.label}</span>
                <span className="text-sm text-slate-500">Open</span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
