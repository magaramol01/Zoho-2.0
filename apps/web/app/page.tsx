'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import BottomTabBar from '@/components/bottom-tab-bar';
import GridSpace, { type GridRow } from '@/components/grid-space';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  LockKeyhole,
  MessageSquare,
  MoreVertical,
  Plus,
  Share,
  ShieldCheck,
  X,
} from 'lucide-react';

const PINNED_TABS_STORAGE_KEY = 'zoho-power-grid:pinned-project-tabs';
const LOG_USER_STORAGE_KEY = 'zoho-power-grid:preferred-log-user-id';
const LOCALHOST_LOGIN_URL = 'http://localhost:3001/api/auth/login';
const LOCALHOST_DISCONNECT_URL = 'http://localhost:3001/api/auth/disconnect';

type Project = {
  id: string;
  name: string;
};

type StatusOption = {
  id: string;
  name: string;
  projectId?: string;
};

type TaskItem = {
  id: string;
  itemNo: string;
  name: string;
  description: string | null;
  projectId: string;
  projectName: string;
  sprintName: string | null;
  statusId: string;
  statusName: string;
  priorityName: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
  dueDate: string | null;
  estimatedMinutes: number | null;
  loggedMinutes: number;
  remainingMinutes: number | null;
  updatedAt: string;
};

type TaskLog = {
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
  metadata: {
    statuses: StatusOption[];
  };
  message?: string;
  details?: string;
};

type NewLogDraft = {
  date: string;
  durationClock: string;
  userId: string;
  billable: boolean;
};

type AssigneeOption = {
  id: string;
  name: string;
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

function formatMinutesAsClock(totalMinutes: number | null | undefined) {
  if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) {
    return '00:00';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseClockToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatHumanDate(value: string) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
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

  const [logPanelTaskId, setLogPanelTaskId] = useState<string | null>(null);
  const [logsByTaskId, setLogsByTaskId] = useState<Record<string, TaskLog[]>>({});
  const [logPanelLoading, setLogPanelLoading] = useState(false);
  const [logPanelError, setLogPanelError] = useState<string | null>(null);
  const [savingLogIds, setSavingLogIds] = useState<Record<string, boolean>>({});
  const [addingLog, setAddingLog] = useState(false);
  const [newLogDraft, setNewLogDraft] = useState<NewLogDraft>({
    date: getTodayIso(),
    durationClock: '00:30',
    userId: '',
    billable: true,
  });
  const [preferredLogUserId, setPreferredLogUserId] = useState('');

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
    if (typeof window === 'undefined') {
      return;
    }

    try {
      setPreferredLogUserId(window.localStorage.getItem(LOG_USER_STORAGE_KEY) ?? '');
    } catch {
      setPreferredLogUserId('');
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
                      metadata: { statuses: [] },
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
    if (typeof window === 'undefined' || !preferredLogUserId) {
      return;
    }

    window.localStorage.setItem(LOG_USER_STORAGE_KEY, preferredLogUserId);
  }, [preferredLogUserId]);

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
                    metadata: { statuses: [] },
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

  const activeProjectTasks = activeProjectId ? tasksByProjectId[activeProjectId] ?? [] : [];

  const selectedTask = useMemo(
    () =>
      logPanelTaskId
        ? activeProjectTasks.find((task) => task.id === logPanelTaskId) ?? null
        : null,
    [activeProjectTasks, logPanelTaskId],
  );

  const selectedTaskAssignees = useMemo<AssigneeOption[]>(
    () =>
      selectedTask
        ? selectedTask.assigneeIds.map((id, index) => ({
            id,
            name: selectedTask.assigneeNames[index] ?? id,
          }))
        : [],
    [selectedTask],
  );

  const activeStatusOptions = useMemo(() => {
    const optionMap = new Map<string, StatusOption>();

    for (const status of bootstrap?.metadata.statuses ?? []) {
      if (!status.projectId || status.projectId === activeProject?.id) {
        optionMap.set(status.id, status);
      }
    }

    for (const task of activeProjectTasks) {
      if (task.statusId && task.statusName && !optionMap.has(task.statusId)) {
        optionMap.set(task.statusId, {
          id: task.statusId,
          name: task.statusName,
          projectId: activeProject?.id,
        });
      }
    }

    return [...optionMap.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [activeProject?.id, activeProjectTasks, bootstrap?.metadata.statuses]);

  const statusIdByName = useMemo(
    () => new Map(activeStatusOptions.map((status) => [status.name, status.id])),
    [activeStatusOptions],
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

  const applyTaskLoggedMinutes = useCallback(
    (taskId: string, loggedMinutes: number) => {
      if (!activeProjectId) {
        return;
      }

      setTasksByProjectId((current) => ({
        ...current,
        [activeProjectId]: (current[activeProjectId] ?? []).map((task) =>
          task.id === taskId
            ? {
                ...task,
                loggedMinutes,
                remainingMinutes:
                  task.estimatedMinutes === null
                    ? null
                    : Math.max(0, task.estimatedMinutes - loggedMinutes),
              }
            : task,
        ),
      }));
    },
    [activeProjectId],
  );

  const fetchTaskLogs = useCallback(
    async (taskId: string) => {
      if (!activeProjectId) {
        return;
      }

      setLogPanelLoading(true);
      setLogPanelError(null);

      try {
        const loadLogs = async (includeTaskId: boolean) => {
          const params = new URLSearchParams({ projectId: activeProjectId });
          if (includeTaskId) {
            params.set('taskId', taskId);
          }

          const response = await fetch(`/api/timesheet?${params.toString()}`, {
            cache: 'no-store',
          });
          const payload = (await response.json()) as Array<TaskLog> & {
            message?: string;
            details?: string;
          };

          return { response, payload };
        };

        let { response, payload } = await loadLogs(true);

        if (
          !response.ok &&
          typeof payload?.message === 'string' &&
          payload.message.includes('taskId should not exist')
        ) {
          ({ response, payload } = await loadLogs(false));
        }

        if (!response.ok) {
          throw new Error(payload.message ?? 'Failed to load task log hours.');
        }

        const logs = (Array.isArray(payload) ? payload : []).filter(
          (log) => log.taskId === taskId,
        );
        setLogsByTaskId((current) => ({
          ...current,
          [taskId]: logs,
        }));
        applyTaskLoggedMinutes(
          taskId,
          logs.reduce((sum, log) => sum + log.durationMinutes, 0),
        );
      } catch (error) {
        setLogPanelError(
          error instanceof Error ? error.message : 'Failed to load task log hours.',
        );
      } finally {
        setLogPanelLoading(false);
      }
    },
    [activeProjectId, applyTaskLoggedMinutes],
  );

  const openLogPanel = useCallback(
    (taskId: string) => {
      const task = activeProjectTasks.find((entry) => entry.id === taskId);
      const defaultUserId = task
        ? task.assigneeIds.includes(preferredLogUserId)
          ? preferredLogUserId
          : task.assigneeIds[task.assigneeIds.length - 1] ?? task.assigneeIds[0] ?? ''
        : preferredLogUserId;

      setLogPanelTaskId(taskId);
      setNewLogDraft({
        date: getTodayIso(),
        durationClock: '00:30',
        userId: defaultUserId,
        billable: true,
      });
      void fetchTaskLogs(taskId);
    },
    [activeProjectTasks, fetchTaskLogs, preferredLogUserId],
  );

  const closeLogPanel = useCallback(() => {
    setLogPanelTaskId(null);
    setLogPanelError(null);
    setSavingLogIds({});
    setAddingLog(false);
  }, []);

  const handleStatusChange = useCallback(
    async (taskId: string, nextStatusName: string, previousStatusName: string) => {
      const statusId = statusIdByName.get(nextStatusName);

      if (!taskId || !statusId || !activeProjectId || nextStatusName === previousStatusName) {
        return;
      }

      setDataError(null);

      setTasksByProjectId((current) => ({
        ...current,
        [activeProjectId]: (current[activeProjectId] ?? []).map((task) =>
          task.id === taskId ? { ...task, statusId, statusName: nextStatusName } : task,
        ),
      }));

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ statusId }),
        });
        const payload = (await response.json()) as TaskItem & {
          message?: string;
          details?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message ?? 'Failed to update status in Zoho.');
        }

        setTasksByProjectId((current) => ({
          ...current,
          [activeProjectId]: (current[activeProjectId] ?? []).map((task) =>
            task.id === taskId ? { ...task, ...payload } : task,
          ),
        }));
      } catch (error) {
        setTasksByProjectId((current) => ({
          ...current,
          [activeProjectId]: (current[activeProjectId] ?? []).map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  statusId: statusIdByName.get(previousStatusName) ?? task.statusId,
                  statusName: previousStatusName,
                }
              : task,
          ),
        }));
        setDataError(
          error instanceof Error ? error.message : 'Failed to update status in Zoho.',
        );
      }
    },
    [activeProjectId, statusIdByName],
  );

  const handleLogFieldChange = useCallback(
    (logId: string, field: 'date' | 'durationMinutes' | 'billable', value: string | number | boolean) => {
      if (!logPanelTaskId) {
        return;
      }

      setLogsByTaskId((current) => ({
        ...current,
        [logPanelTaskId]: (current[logPanelTaskId] ?? []).map((log) =>
          log.id === logId ? { ...log, [field]: value } : log,
        ),
      }));
    },
    [logPanelTaskId],
  );

  const handleSaveLog = useCallback(
    async (logId: string) => {
      if (!logPanelTaskId) {
        return;
      }

      const log = (logsByTaskId[logPanelTaskId] ?? []).find((entry) => entry.id === logId);
      if (!log) {
        return;
      }

      setSavingLogIds((current) => ({ ...current, [logId]: true }));
      setLogPanelError(null);

      try {
        const response = await fetch(`/api/timesheet/${logId}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            date: log.date,
            durationMinutes: log.durationMinutes,
            billable: log.billable,
            notes: log.notes,
          }),
        });
        const payload = (await response.json()) as TaskLog & {
          message?: string;
          details?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message ?? 'Failed to update log hours in Zoho.');
        }

        setLogsByTaskId((current) => {
          const nextLogs = (current[logPanelTaskId] ?? []).map((entry) =>
            entry.id === logId ? { ...entry, ...payload } : entry,
          );
          applyTaskLoggedMinutes(
            logPanelTaskId,
            nextLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0),
          );
          return {
            ...current,
            [logPanelTaskId]: nextLogs,
          };
        });
      } catch (error) {
        setLogPanelError(
          error instanceof Error ? error.message : 'Failed to update log hours in Zoho.',
        );
      } finally {
        setSavingLogIds((current) => ({ ...current, [logId]: false }));
      }
    },
    [applyTaskLoggedMinutes, logPanelTaskId, logsByTaskId],
  );

  const handleAddLog = useCallback(async () => {
    if (!selectedTask) {
      return;
    }

    const durationMinutes = parseClockToMinutes(newLogDraft.durationClock);
    if (durationMinutes === null || durationMinutes <= 0) {
      setLogPanelError('Enter log hours in HH:MM format.');
      return;
    }

    setAddingLog(true);
    setLogPanelError(null);

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}/logs`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          date: newLogDraft.date,
          durationMinutes,
          userId: newLogDraft.userId || undefined,
          billable: newLogDraft.billable,
          notes: '',
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Failed to add log hours to Zoho.');
      }

      setNewLogDraft({
        date: getTodayIso(),
        durationClock: '00:30',
        userId: newLogDraft.userId,
        billable: true,
      });
      if (newLogDraft.userId) {
        setPreferredLogUserId(newLogDraft.userId);
      }
      await fetchTaskLogs(selectedTask.id);
    } catch (error) {
      setLogPanelError(
        error instanceof Error ? error.message : 'Failed to add log hours to Zoho.',
      );
    } finally {
      setAddingLog(false);
    }
  }, [fetchTaskLogs, newLogDraft, selectedTask]);

  const taskRows = useMemo<GridRow[]>(
    () =>
      activeProjectTasks.map((task) => ({
        id: task.id,
        itemNo: Number(task.itemNo),
        name: task.name,
        statusId: task.statusId,
        statusName: task.statusName,
        priorityName: task.priorityName ?? '',
        assigneeNames: task.assigneeNames.join(', '),
        sprintName: task.sprintName ?? '',
        dueDate:
          task.dueDate && task.dueDate !== '-1' ? formatIsoDate(task.dueDate) : null,
        loggedMinutes: task.loggedMinutes,
      })),
    [activeProjectTasks],
  );

  const columnDefs = useMemo<ColDef<GridRow>[]>(
    () => [
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
        minWidth: 220,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: { data?: GridRow; value?: string | number | null }) => {
          const taskId = String(params.data?.id ?? '');
          const currentValue =
            typeof params.value === 'string' ? params.value : String(params.value ?? '');

          return (
            <select
              value={currentValue}
              disabled={!taskId || activeStatusOptions.length === 0}
              onChange={(event) =>
                void handleStatusChange(taskId, event.target.value, currentValue)
              }
              className="h-7 min-w-[170px] rounded border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              {activeStatusOptions.map((status) => (
                <option key={status.id} value={status.name}>
                  {status.name}
                </option>
              ))}
            </select>
          );
        },
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
        field: 'loggedMinutes',
        headerName: 'Log Hours',
        minWidth: 190,
        filter: 'agNumberColumnFilter',
        cellRenderer: (params: { data?: GridRow; value?: string | number | null }) => {
          const taskId = String(params.data?.id ?? '');
          const loggedMinutes =
            typeof params.value === 'number' ? params.value : Number(params.value ?? 0);

          return (
            <button
              type="button"
              onClick={() => taskId && openLogPanel(taskId)}
              className="inline-flex h-7 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              <Clock3 className="h-3.5 w-3.5" />
              {formatMinutesAsClock(loggedMinutes)}
            </button>
          );
        },
      },
    ],
    [activeStatusOptions, handleStatusChange, openLogPanel],
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

  const selectedTaskLogs = selectedTask ? logsByTaskId[selectedTask.id] ?? [] : [];

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
          </aside>
        </div>
      </main>
    );
  }

  return (
    <>
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
            <a
              href={LOCALHOST_DISCONNECT_URL}
              className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 md:inline-flex"
            >
              Reconnect Zoho
            </a>
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

      {selectedTask ? (
        <TaskLogDrawer
          task={selectedTask}
          logs={selectedTaskLogs}
          loading={logPanelLoading}
          error={logPanelError}
          onClose={closeLogPanel}
          onRefresh={() => void fetchTaskLogs(selectedTask.id)}
          onLogFieldChange={handleLogFieldChange}
          onSaveLog={handleSaveLog}
          savingLogIds={savingLogIds}
          assigneeOptions={selectedTaskAssignees}
          newLogDraft={newLogDraft}
          setNewLogDraft={setNewLogDraft}
          onAddLog={() => void handleAddLog()}
          addingLog={addingLog}
        />
      ) : null}
    </>
  );
}

function TaskLogDrawer({
  task,
  logs,
  loading,
  error,
  onClose,
  onRefresh,
  onLogFieldChange,
  onSaveLog,
  savingLogIds,
  assigneeOptions,
  newLogDraft,
  setNewLogDraft,
  onAddLog,
  addingLog,
}: {
  task: TaskItem;
  logs: TaskLog[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onLogFieldChange: (
    logId: string,
    field: 'date' | 'durationMinutes' | 'billable',
    value: string | number | boolean,
  ) => void;
  onSaveLog: (logId: string) => void;
  savingLogIds: Record<string, boolean>;
  assigneeOptions: AssigneeOption[];
  newLogDraft: NewLogDraft;
  setNewLogDraft: React.Dispatch<React.SetStateAction<NewLogDraft>>;
  onAddLog: () => void;
  addingLog: boolean;
}) {
  const groupedLogs = useMemo(() => {
    const groups = new Map<string, TaskLog[]>();

    for (const log of logs) {
      const dateKey = log.date;
      const existing = groups.get(dateKey) ?? [];
      existing.push(log);
      groups.set(dateKey, existing);
    }

    return [...groups.entries()]
      .sort((left, right) => right[0].localeCompare(left[0]))
      .map(([date, entries]) => ({
        date,
        totalMinutes: entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
        entries,
      }));
  }, [logs]);

  const totalLoggedMinutes = logs.reduce((sum, log) => sum + log.durationMinutes, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Log Hours
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{task.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{task.projectName}</span>
              <span>{task.sprintName ?? 'No sprint'}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                <Clock3 className="h-3.5 w-3.5" />
                Total {formatMinutesAsClock(totalLoggedMinutes)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 p-2 text-slate-500 hover:border-slate-400 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="grid gap-3 md:grid-cols-[1fr_140px_1fr_100px_auto]">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="font-medium">Date</span>
              <input
                type="date"
                value={newLogDraft.date}
                onChange={(event) =>
                  setNewLogDraft((current) => ({ ...current, date: event.target.value }))
                }
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-slate-800 outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="font-medium">Logged</span>
              <input
                type="time"
                step={300}
                value={newLogDraft.durationClock}
                onChange={(event) =>
                  setNewLogDraft((current) => ({
                    ...current,
                    durationClock: event.target.value,
                  }))
                }
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-slate-800 outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="font-medium">Log as</span>
              <select
                value={newLogDraft.userId}
                onChange={(event) =>
                  setNewLogDraft((current) => ({
                    ...current,
                    userId: event.target.value,
                  }))
                }
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-slate-800 outline-none focus:border-blue-500"
              >
                {assigneeOptions.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newLogDraft.billable}
                onChange={(event) =>
                  setNewLogDraft((current) => ({
                    ...current,
                    billable: event.target.checked,
                  }))
                }
              />
              Billable
            </label>
            <button
              type="button"
              onClick={onAddLog}
              disabled={addingLog}
              className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Plus className="h-4 w-4" />
              {addingLog ? 'Adding...' : 'Add Log'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3 text-sm text-slate-500">
          <div className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Grouped by date with editable hours
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            Refresh
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">
              Loading task log hours...
            </div>
          ) : groupedLogs.length ? (
            <div className="space-y-5">
              {groupedLogs.map((group) => (
                <section
                  key={group.date}
                  className="rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatHumanDate(group.date)}
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                      {formatMinutesAsClock(group.totalMinutes)}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.entries.map((log) => (
                      <div
                        key={log.id}
                        className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_130px_90px_auto]"
                      >
                        <label className="flex flex-col gap-2 text-sm text-slate-600">
                          <span className="font-medium">Date</span>
                          <input
                            type="date"
                            value={log.date}
                            onChange={(event) =>
                              onLogFieldChange(log.id, 'date', event.target.value)
                            }
                            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-slate-800 outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-slate-600">
                          <span className="font-medium">Logged</span>
                          <input
                            type="time"
                            step={300}
                            value={formatMinutesAsClock(log.durationMinutes)}
                            onChange={(event) => {
                              const nextMinutes = parseClockToMinutes(event.target.value);
                              if (nextMinutes !== null) {
                                onLogFieldChange(log.id, 'durationMinutes', nextMinutes);
                              }
                            }}
                            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-slate-800 outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={log.billable}
                            onChange={(event) =>
                              onLogFieldChange(log.id, 'billable', event.target.checked)
                            }
                          />
                          Billable
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => onSaveLog(log.id)}
                            disabled={Boolean(savingLogIds[log.id])}
                            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            {savingLogIds[log.id] ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">
              No log hours yet for this task. Add the first entry above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
