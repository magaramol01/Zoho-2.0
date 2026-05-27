'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import BottomTabBar from '@/components/bottom-tab-bar';
import GridSpace, { type GridRow } from '@/components/grid-space';
import {
  FileSpreadsheet,
  MessageSquare,
  MoreVertical,
  Share,
} from 'lucide-react';

const PINNED_TABS_STORAGE_KEY = 'zoho-power-grid:pinned-project-tabs';

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
  projects: Project[];
  tasks: TaskItem[];
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

const dateFilterParams = {
  buttons: ['apply', 'reset', 'clear', 'cancel'],
  closeOnApply: true,
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const loadSpreadsheet = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/spreadsheet', { cache: 'no-store' });
        const payload = (await response.json()) as SpreadsheetPayload;

        if (!response.ok) {
          throw new Error(payload.message ?? 'Failed to load spreadsheet data.');
        }

        if (cancelled) {
          return;
        }

        setProjects(payload.projects ?? []);
        setTasks(payload.tasks ?? []);

        const firstProjectId =
          payload.projects.find((project) =>
            payload.tasks.some((task) => task.projectId === project.id),
          )?.id ??
          payload.projects[0]?.id ??
          '';

        setActiveProjectId((current) =>
          current && payload.projects.some((project) => project.id === current)
            ? current
            : firstProjectId,
        );
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the spreadsheet data.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSpreadsheet();

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

  const taskRows = useMemo<GridRow[]>(
    () =>
      tasks
        .filter((task) => !activeProject || task.projectId === activeProject.id)
        .map((task) => ({
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
    [activeProject, tasks],
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
    : loading
      ? 'Loading projects...'
      : 'No project selected';

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
          <MessageSquare className="h-5 w-5 cursor-pointer text-gray-600" />
          <MoreVertical className="h-5 w-5 cursor-pointer text-gray-600" />
          <div className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-blue-100 px-5 font-medium text-blue-700 hover:bg-blue-200">
            <Share className="h-4 w-4" />
            Share
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 font-bold text-white">
            Z
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
            {error ? (
              <div className="flex h-full items-center justify-center bg-white px-6 text-center">
                <div>
                  <div className="text-base font-medium text-gray-800">
                    Unable to load real project data
                  </div>
                  <div className="mt-2 text-sm text-gray-500">{error}</div>
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
