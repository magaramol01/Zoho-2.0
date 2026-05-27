'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import BottomTabBar from '@/components/bottom-tab-bar';
import GridSpace, { type GridRow } from '@/components/grid-space';
import {
  ArrowRight,
  FileSpreadsheet,
  LockKeyhole,
  MessageSquare,
  MoreVertical,
  Share,
  ShieldCheck,
} from 'lucide-react';

const PINNED_TABS_STORAGE_KEY = 'zoho-power-grid:pinned-project-tabs';
const LOCALHOST_LOGIN_URL = 'http://localhost:3001/api/auth/login';

type Project = {
  id: string;
  name: string;
};

type TaskItem = {
  id: string;
  itemNo: string;
  name: string;
  description: string | null;
  projectId: string;
  projectName: string;
  sprintName: string | null;
  statusName: string;
  priorityName: string | null;
  assigneeNames: string[];
  dueDate: string | null;
  remainingMinutes: number | null;
  updatedAt: string;
};

type SpreadsheetPayload = {
  tasks: TaskItem[];
  message?: string;
  details?: string;
};

type ProjectsPayload = {
  projects: Project[];
  message?: string;
  details?: string;
};

type BootstrapPayload = {
  authenticated: boolean;
  authUrl: string | null;
  currentUser: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  message?: string;
  details?: string;
};

function formatIsoDate(value: string | null) {
  if (!value || value === '-1') {
    return '';
  }

  if (value.includes('T')) {
    return value.slice(0, 10);
  }

  return value;
}

function formatRemainingMinutes(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '';
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatUpdatedAt(value: string) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

function getUserInitial(displayName: string | undefined, email: string | undefined) {
  const source = displayName?.trim() || email?.trim() || 'Z';
  return source.charAt(0).toUpperCase();
}

const dateFilterParams = {
  comparator: (filterLocalDateAtMidnight: Date, cellValue: unknown) => {
    if (!cellValue || typeof cellValue !== 'string') {
      return -1;
    }

    const parsedCellDate = new Date(cellValue);

    if (Number.isNaN(parsedCellDate.getTime())) {
      return -1;
    }

    const cellDateAtMidnight = new Date(
      parsedCellDate.getFullYear(),
      parsedCellDate.getMonth(),
      parsedCellDate.getDate(),
    );

    if (cellDateAtMidnight < filterLocalDateAtMidnight) {
      return -1;
    }

    if (cellDateAtMidnight > filterLocalDateAtMidnight) {
      return 1;
    }

    return 0;
  },
};

const columnDefs: ColDef<GridRow>[] = [
  {
    field: 'itemNo',
    headerName: 'Item',
    minWidth: 110,
    maxWidth: 140,
    filter: 'agNumberColumnFilter',
  },
  {
    field: 'id',
    headerName: 'Task ID',
    minWidth: 190,
    filter: 'agTextColumnFilter',
  },
  {
    field: 'name',
    headerName: 'Title',
    minWidth: 260,
    flex: 1.8,
    filter: 'agTextColumnFilter',
  },
  {
    field: 'statusName',
    headerName: 'Status',
    minWidth: 160,
    filter: 'agTextColumnFilter',
  },
  {
    field: 'priorityName',
    headerName: 'Priority',
    minWidth: 130,
    filter: 'agTextColumnFilter',
  },
  {
    field: 'assigneeNames',
    headerName: 'Assignees',
    minWidth: 180,
    filter: 'agTextColumnFilter',
  },
  {
    field: 'sprintName',
    headerName: 'Sprint',
    minWidth: 180,
    filter: 'agTextColumnFilter',
  },
  {
    field: 'dueDate',
    headerName: 'Due date',
    minWidth: 130,
    filter: 'agDateColumnFilter',
    filterParams: dateFilterParams,
    valueFormatter: (params) => formatIsoDate(params.value as string | null),
  },
  {
    field: 'remainingMinutes',
    headerName: 'Remaining',
    minWidth: 130,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params) =>
      formatRemainingMinutes(
        typeof params.value === 'number' ? params.value : Number(params.value ?? NaN),
      ),
  },
  {
    field: 'updatedAt',
    headerName: 'Updated',
    minWidth: 130,
    filter: 'agDateColumnFilter',
    filterParams: dateFilterParams,
    valueFormatter: (params) => formatUpdatedAt(params.value as string),
  },
];

export default function Page() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProjectId, setTasksByProjectId] = useState<Record<string, TaskItem[]>>({});
  const [activeProjectId, setActiveProjectId] = useState('');
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const savedPinnedTabs = window.localStorage.getItem(PINNED_TABS_STORAGE_KEY);

      if (!savedPinnedTabs) {
        return;
      }

      const parsedPinnedTabs = JSON.parse(savedPinnedTabs) as unknown;
      if (!Array.isArray(parsedPinnedTabs)) {
        return;
      }

      setPinnedProjectIds(parsedPinnedTabs.map((entry) => String(entry)));
    } catch {
      setPinnedProjectIds([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setLoading(true);
      setAuthError(null);
      setDataError(null);

      try {
        const bootstrapResponse = await fetch('/api/bootstrap', { cache: 'no-store' });
        const bootstrapPayload = (await bootstrapResponse.json()) as BootstrapPayload;

        if (!bootstrapResponse.ok) {
          throw new Error(bootstrapPayload.message ?? 'Unable to verify the Zoho session.');
        }

        if (cancelled) {
          return;
        }

        setBootstrap(bootstrapPayload);

        if (!bootstrapPayload.authenticated) {
          setProjects([]);
          setTasksByProjectId({});
          setActiveProjectId('');
          return;
        }

        try {
          const projectsResponse = await fetch('/api/projects', { cache: 'no-store' });
          const projectsPayload = (await projectsResponse.json()) as ProjectsPayload;

          if (!projectsResponse.ok) {
            if (projectsResponse.status === 401 || projectsResponse.status === 403) {
              setBootstrap((current) =>
                current
                  ? {
                      ...current,
                      authenticated: false,
                      currentUser: null,
                      authUrl: current.authUrl ?? LOCALHOST_LOGIN_URL,
                    }
                  : {
                      authenticated: false,
                      currentUser: null,
                      authUrl: LOCALHOST_LOGIN_URL,
                    },
              );
              setProjects([]);
              setTasksByProjectId({});
              setActiveProjectId('');
              return;
            }

            throw new Error(projectsPayload.message ?? 'Failed to load the project tabs.');
          }

          if (cancelled) {
            return;
          }

          setProjects(projectsPayload.projects ?? []);
          setTasksByProjectId({});
          setActiveProjectId((current) =>
            current &&
            projectsPayload.projects.some((project) => project.id === current)
              ? current
              : projectsPayload.projects[0]?.id ?? '',
          );
        } catch (projectsError) {
          if (cancelled) {
            return;
          }

          setDataError(
            projectsError instanceof Error
              ? projectsError.message
              : 'Failed to load the project tabs.',
          );
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setAuthError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to start Zoho Power Grid.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      PINNED_TABS_STORAGE_KEY,
      JSON.stringify(pinnedProjectIds),
    );
  }, [pinnedProjectIds]);

  useEffect(() => {
    if (!bootstrap?.authenticated || !activeProjectId) {
      setTasksLoading(false);
      return;
    }

    setDataError(null);

    if (activeProjectId in tasksByProjectId) {
      setTasksLoading(false);
      return;
    }

    let cancelled = false;

    const loadProjectTasks = async () => {
      setTasksLoading(true);

      try {
        const params = new URLSearchParams({ projectId: activeProjectId });
        const response = await fetch(`/api/spreadsheet?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as SpreadsheetPayload;

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setBootstrap((current) =>
              current
                ? {
                    ...current,
                    authenticated: false,
                    currentUser: null,
                    authUrl: current.authUrl ?? LOCALHOST_LOGIN_URL,
                  }
                : {
                    authenticated: false,
                    currentUser: null,
                    authUrl: LOCALHOST_LOGIN_URL,
                  },
            );
            setProjects([]);
            setTasksByProjectId({});
            setActiveProjectId('');
            return;
          }

          throw new Error(payload.message ?? 'Failed to load this project tab.');
        }

        if (cancelled) {
          return;
        }

        setTasksByProjectId((current) => ({
          ...current,
          [activeProjectId]: payload.tasks ?? [],
        }));
      } catch (tasksError) {
        if (cancelled) {
          return;
        }

        setDataError(
          tasksError instanceof Error
            ? tasksError.message
            : 'Failed to load this project tab.',
        );
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    };

    void loadProjectTasks();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, bootstrap?.authenticated, tasksByProjectId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );

  const orderedProjects = useMemo(() => {
    const pinnedOrder = new Map(
      pinnedProjectIds.map((projectId, index) => [projectId, index]),
    );

    const pinnedProjects = projects
      .filter((project) => pinnedOrder.has(project.id))
      .sort(
        (left, right) =>
          (pinnedOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (pinnedOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      );

    const unpinnedProjects = projects.filter((project) => !pinnedOrder.has(project.id));

    return [...pinnedProjects, ...unpinnedProjects];
  }, [pinnedProjectIds, projects]);

  const activeProjectTasks = activeProjectId ? tasksByProjectId[activeProjectId] ?? [] : [];

  const taskRows = useMemo<GridRow[]>(
    () =>
      activeProjectTasks.map((task) => ({
        id: task.id,
        itemNo: Number(task.itemNo),
        name: task.name,
        statusName: task.statusName,
        priorityName: task.priorityName ?? '',
        assigneeNames: task.assigneeNames.join(', '),
        sprintName: task.sprintName ?? '',
        dueDate:
          task.dueDate && task.dueDate !== '-1' ? formatIsoDate(task.dueDate) : null,
        remainingMinutes: task.remainingMinutes,
        updatedAt: task.updatedAt,
      })),
    [activeProjectTasks],
  );

  const handleTogglePinnedProject = (projectId: string) => {
    setPinnedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((entry) => entry !== projectId)
        : [projectId, ...current],
    );
  };

  const formulaText = activeProject
    ? `${activeProject.name} | ${taskRows.length} items`
    : loading || tasksLoading
      ? 'Loading projects...'
      : 'No project selected';

  const loginHref = bootstrap?.authUrl ?? LOCALHOST_LOGIN_URL;
  const userInitial = getUserInitial(
    bootstrap?.currentUser?.displayName,
    bootstrap?.currentUser?.email,
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_32%,#f8fafc_72%)] px-6 text-slate-900">
        <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/80 p-8 text-center shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Opening Zoho Power Grid
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Checking your localhost Zoho session before loading the dashboard.
          </p>
        </div>
      </main>
    );
  }

  if (!bootstrap?.authenticated) {
    return (
      <main className="flex min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#eff6ff_42%,#ecfeff_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_36px_90px_rgba(15,23,42,0.14)] backdrop-blur lg:p-10">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="absolute bottom-0 left-10 h-36 w-36 rounded-full bg-sky-200/40 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-700">
                <LockKeyhole className="h-3.5 w-3.5" />
                Login Required
              </div>
              <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
                Connect Zoho first, then open the dashboard.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                This localhost build stays locked until a Zoho OAuth session is created.
                If the user has not signed in with Zoho yet, they stay here instead of
                landing on the sheet directly.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={loginHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Continue with Zoho
                  <ArrowRight className="h-4 w-4" />
                </a>
                <div className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm text-slate-600">
                  Local auth callback returns to `localhost:3000`
                </div>
              </div>

              {authError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {authError}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="rounded-[32px] border border-slate-200/80 bg-slate-950 p-6 text-slate-50 shadow-[0_30px_70px_rgba(15,23,42,0.18)] lg:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Dashboard access is gated</div>
                <div className="text-sm text-slate-400">
                  Only signed-in localhost users can reach the grid.
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium text-white">What happens now</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Zoho OAuth starts from the backend, the callback stores the session cookie,
                  and then it redirects back to the frontend on `localhost:3000`.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium text-white">After login</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  The page checks `/api/bootstrap` first. Then it loads only the project tabs.
                  Each project tab fetches its own tasks when you open it.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-white text-sm font-sans">
      <header className="flex h-16 w-full items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-green-100 text-green-700">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-medium leading-tight text-gray-800">
              {activeProject?.name ?? 'Project sheet'}
            </h1>
            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">File</span>
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">Edit</span>
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">View</span>
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">Insert</span>
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">Format</span>
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">Data</span>
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">Tools</span>
              <span className="cursor-pointer rounded px-1 hover:bg-gray-100">Help</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-right md:block">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
              Connected user
            </div>
            <div className="text-sm text-gray-700">
              {bootstrap.currentUser?.displayName || bootstrap.currentUser?.email}
            </div>
          </div>
          <MessageSquare className="h-5 w-5 cursor-pointer text-gray-600" />
          <MoreVertical className="h-5 w-5 cursor-pointer text-gray-600" />
          <div className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-blue-100 px-5 font-medium text-blue-700 hover:bg-blue-200">
            <Share className="h-4 w-4" />
            Share
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 font-bold text-white">
            {userInitial}
          </div>
        </div>
      </header>

      <div className="flex h-9 w-full min-w-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 text-gray-600">
        <div className="border-r border-gray-300 pr-2 font-mono text-xs text-gray-500">fx</div>
        <div className="min-w-0 flex-1 truncate text-sm">{formulaText}</div>
      </div>

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            {dataError ? (
              <div className="flex h-full items-center justify-center bg-white px-6 text-center">
                <div>
                  <div className="text-base font-medium text-gray-800">
                    Unable to load real project data
                  </div>
                  <div className="mt-2 text-sm text-gray-500">{dataError}</div>
                </div>
              </div>
            ) : tasksLoading && !(activeProject?.id && activeProject.id in tasksByProjectId) ? (
              <div className="flex h-full items-center justify-center bg-white px-6 text-center">
                <div>
                  <div className="text-base font-medium text-gray-800">
                    Loading {activeProject?.name ?? 'project'} tab
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Fetching only this tab&apos;s tasks to keep the dashboard fast.
                  </div>
                </div>
              </div>
            ) : (
              <GridSpace
                key={activeProject?.id ?? 'grid'}
                rowData={taskRows}
                columnDefs={columnDefs}
                filterStorageKey={
                  activeProject ? `zoho-power-grid:filters:${activeProject.id}` : null
                }
              />
            )}
          </div>
          <BottomTabBar
            sheets={orderedProjects.map((project) => ({ id: project.id, name: project.name }))}
            activeSheetId={activeProject?.id ?? ''}
            onSheetChange={setActiveProjectId}
            pinnedSheetIds={pinnedProjectIds}
            onTogglePin={handleTogglePinnedProject}
          />
        </div>
      </div>
    </main>
  );
}
