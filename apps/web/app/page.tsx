"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColDef } from "ag-grid-community"
import BottomTabBar from "@/components/bottom-tab-bar"
import GridSpace, { type GridRow } from "@/components/grid-space"
import TimesheetAnalytics, {
  type AnalyticsUserOption,
  type TimesheetAnalyticsSummary,
} from "@/components/timesheet-analytics"
import {
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Share,
  UserRound,
  X,
} from "lucide-react"
import GreythrIntegration from "@/components/greythr-integration"

const PINNED_TABS_STORAGE_KEY = "zoho-power-grid:pinned-project-tabs"
const LOG_USER_STORAGE_KEY = "zoho-power-grid:preferred-log-user-id"
const LOCALHOST_LOGIN_URL = "http://localhost:3001/api/auth/login"
const LOCALHOST_DISCONNECT_URL = "http://localhost:3001/api/auth/disconnect"

type Project = {
  id: string
  name: string
}

type StatusOption = {
  id: string
  name: string
  projectId?: string
}

type TaskItem = {
  id: string
  itemNo: string
  name: string
  description: string | null
  projectId: string
  projectName: string
  sprintName: string | null
  statusId: string
  statusName: string
  priorityName: string | null
  assigneeIds: string[]
  assigneeNames: string[]
  dueDate: string | null
  estimatedMinutes: number | null
  loggedMinutes: number
  remainingMinutes: number | null
  updatedAt: string
}

type TaskLog = {
  id: string
  taskId: string | null
  projectId: string
  projectName: string
  sprintId: string | null
  taskName: string | null
  date: string
  durationMinutes: number
  notes: string
  userId: string | null
  userName: string | null
  billable: boolean
  updatedAt: string
}

type SpreadsheetPayload = {
  tasks: TaskItem[]
  message?: string
  details?: string
}

type ProjectsPayload = {
  projects: Project[]
  message?: string
  details?: string
}

type BootstrapPayload = {
  authenticated: boolean
  authUrl: string | null
  currentUser: {
    id: string
    email: string
    displayName: string
  } | null
  metadata: {
    statuses: StatusOption[]
    users: AnalyticsUserOption[]
  }
  message?: string
  details?: string
}

type NewLogDraft = {
  date: string
  durationClock: string
  userId: string
  billable: boolean
}

type AssigneeOption = {
  id: string
  name: string
}

function formatIsoDate(value: string | null) {
  if (!value || value === "-1") {
    return ""
  }

  if (value.includes("T")) {
    return value.slice(0, 10)
  }

  return value
}

function formatMinutesAsClock(totalMinutes: number | null | undefined) {
  if (
    totalMinutes === null ||
    totalMinutes === undefined ||
    Number.isNaN(totalMinutes)
  ) {
    return "00:00"
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function parseClockToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

function formatHumanDate(value: string) {
  if (!value) {
    return ""
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getTodayIso() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`
}

function getUserInitial(
  displayName: string | undefined,
  email: string | undefined
) {
  const source = displayName?.trim() || email?.trim() || "Z"
  return source.charAt(0).toUpperCase()
}

const dateFilterParams = {
  comparator: (filterLocalDateAtMidnight: Date, cellValue: unknown) => {
    if (!cellValue || typeof cellValue !== "string") {
      return -1
    }

    const parsedCellDate = new Date(cellValue)

    if (Number.isNaN(parsedCellDate.getTime())) {
      return -1
    }

    const cellDateAtMidnight = new Date(
      parsedCellDate.getFullYear(),
      parsedCellDate.getMonth(),
      parsedCellDate.getDate()
    )

    if (cellDateAtMidnight < filterLocalDateAtMidnight) {
      return -1
    }

    if (cellDateAtMidnight > filterLocalDateAtMidnight) {
      return 1
    }

    return 0
  },
}

export default function Page() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null)
  const [activeView, setActiveView] = useState<"sheet" | "analytics">("sheet")
  const [projects, setProjects] = useState<Project[]>([])
  const [tasksByProjectId, setTasksByProjectId] = useState<
    Record<string, TaskItem[]>
  >({})
  const [activeProjectId, setActiveProjectId] = useState("")
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  
  const [greythrDataMap, setGreythrDataMap] = useState<Record<string, string>>({})
  const [greythrRealtime, setGreythrRealtime] = useState<{ totalHours: string, currentStatus: string } | null>(null)
  const [syncingProject, setSyncingProject] = useState(false)

  const handleSyncData = useCallback(async () => {
    if (activeView === "analytics") {
      setSyncingProject(true)
      try {
        const res = await fetch("http://localhost:3001/api/greythr/sync", { method: "POST" })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (data.realtime) setGreythrRealtime(data.realtime)
        if (data.dailyData) setGreythrDataMap(data.dailyData)
      } catch (err) {
        console.error("Greythr sync error:", err)
      } finally {
        setSyncingProject(false)
      }
    } else {
      if (!activeProjectId) return
      setSyncingProject(true)
      try {
        await fetch(`http://localhost:3001/api/projects/${activeProjectId}/sync`, {
          method: "POST",
        })
        window.location.reload()
      } catch (err) {
        console.error(err)
      } finally {
        setSyncingProject(false)
      }
    }
  }, [activeView, activeProjectId])

  const [logPanelTaskId, setLogPanelTaskId] = useState<string | null>(null)
  const [logsByTaskId, setLogsByTaskId] = useState<Record<string, TaskLog[]>>(
    {}
  )
  const [logPanelLoading, setLogPanelLoading] = useState(false)
  const [logPanelError, setLogPanelError] = useState<string | null>(null)
  const [savingLogIds, setSavingLogIds] = useState<Record<string, boolean>>({})
  const [addingLog, setAddingLog] = useState(false)
  const [newLogDraft, setNewLogDraft] = useState<NewLogDraft>({
    date: getTodayIso(),
    durationClock: "00:30",
    userId: "",
    billable: true,
  })
  const [preferredLogUserId, setPreferredLogUserId] = useState("")
  const [analyticsUserId, setAnalyticsUserId] = useState("")
  const [analytics, setAnalytics] = useState<TimesheetAnalyticsSummary | null>(
    null
  )
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const savedPinnedTabs = window.localStorage.getItem(
        PINNED_TABS_STORAGE_KEY
      )

      if (!savedPinnedTabs) {
        return
      }

      const parsedPinnedTabs = JSON.parse(savedPinnedTabs) as unknown
      if (!Array.isArray(parsedPinnedTabs)) {
        return
      }

      setPinnedProjectIds(parsedPinnedTabs.map((entry) => String(entry)))
    } catch {
      setPinnedProjectIds([])
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      setPreferredLogUserId(
        window.localStorage.getItem(LOG_USER_STORAGE_KEY) ?? ""
      )
    } catch {
      setPreferredLogUserId("")
    }
  }, [])

  useEffect(() => {
    if (!preferredLogUserId) {
      return
    }

    setAnalyticsUserId((current) => current || preferredLogUserId)
  }, [preferredLogUserId])

  useEffect(() => {
    let cancelled = false

    const loadPage = async () => {
      setLoading(true)
      setDataError(null)

      try {
        const bootstrapResponse = await fetch("/api/bootstrap", {
          cache: "no-store",
        })
        const bootstrapPayload =
          (await bootstrapResponse.json()) as BootstrapPayload

        if (!bootstrapResponse.ok) {
          throw new Error(
            bootstrapPayload.message ?? "Unable to verify the Zoho session."
          )
        }

        if (cancelled) {
          return
        }

        setBootstrap(bootstrapPayload)

        if (!bootstrapPayload.authenticated) {
          setProjects([])
          setTasksByProjectId({})
          setActiveProjectId("")
          return
        }

        try {
          const projectsResponse = await fetch("/api/projects", {
            cache: "no-store",
          })
          const projectsPayload =
            (await projectsResponse.json()) as ProjectsPayload

          if (!projectsResponse.ok) {
            if (
              projectsResponse.status === 401 ||
              projectsResponse.status === 403
            ) {
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
                      metadata: { statuses: [], users: [] },
                    }
              )
              setProjects([])
              setTasksByProjectId({})
              setActiveProjectId("")
              return
            }

            throw new Error(
              projectsPayload.message ?? "Failed to load the project tabs."
            )
          }

          if (cancelled) {
            return
          }

          setProjects(projectsPayload.projects ?? [])
          setTasksByProjectId({})
          setActiveProjectId((current) =>
            current &&
            projectsPayload.projects.some((project) => project.id === current)
              ? current
              : (projectsPayload.projects[0]?.id ?? "")
          )
        } catch (projectsError) {
          if (cancelled) {
            return
          }

          setDataError(
            projectsError instanceof Error
              ? projectsError.message
              : "Failed to load the project tabs."
          )
        }
      } catch {
        if (cancelled) {
          return
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      PINNED_TABS_STORAGE_KEY,
      JSON.stringify(pinnedProjectIds)
    )
  }, [pinnedProjectIds])

  useEffect(() => {
    if (typeof window === "undefined" || !preferredLogUserId) {
      return
    }

    window.localStorage.setItem(LOG_USER_STORAGE_KEY, preferredLogUserId)
  }, [preferredLogUserId])

  useEffect(() => {
    if (!bootstrap?.authenticated || !activeProjectId) {
      setTasksLoading(false)
      return
    }

    setDataError(null)

    if (activeProjectId in tasksByProjectId) {
      setTasksLoading(false)
      return
    }

    let cancelled = false

    const loadProjectTasks = async () => {
      setTasksLoading(true)

      try {
        const params = new URLSearchParams({ projectId: activeProjectId })
        const response = await fetch(`/api/spreadsheet?${params.toString()}`, {
          cache: "no-store",
        })
        const payload = (await response.json()) as SpreadsheetPayload

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
                    metadata: { statuses: [], users: [] },
                  }
            )
            setProjects([])
            setTasksByProjectId({})
            setActiveProjectId("")
            return
          }

          throw new Error(payload.message ?? "Failed to load this project tab.")
        }

        if (cancelled) {
          return
        }

        setTasksByProjectId((current) => ({
          ...current,
          [activeProjectId]: payload.tasks ?? [],
        }))
      } catch (tasksError) {
        if (cancelled) {
          return
        }

        setDataError(
          tasksError instanceof Error
            ? tasksError.message
            : "Failed to load this project tab."
        )
      } finally {
        if (!cancelled) {
          setTasksLoading(false)
        }
      }
    }

    void loadProjectTasks()

    return () => {
      cancelled = true
    }
  }, [activeProjectId, bootstrap?.authenticated, tasksByProjectId])

  useEffect(() => {
    if (!bootstrap?.authenticated || activeView !== "analytics") {
      setAnalyticsLoading(false)
      return
    }

    let cancelled = false

    const loadAnalytics = async () => {
      setAnalyticsLoading(true)
      setAnalyticsError(null)

      try {
        const params = new URLSearchParams({ weeks: "12" })
        if (analyticsUserId) {
          params.set("userId", analyticsUserId)
        }

        const response = await fetch(
          `/api/timesheet/analytics?${params.toString()}`,
          {
            cache: "no-store",
          }
        )
        const payload = (await response.json()) as TimesheetAnalyticsSummary & {
          message?: string
          details?: string
        }

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
                    metadata: { statuses: [], users: [] },
                  }
            )
            setProjects([])
            setTasksByProjectId({})
            setActiveProjectId("")
            return
          }

          throw new Error(
            payload.message ?? "Failed to load the timesheet analytics."
          )
        }

        if (cancelled) {
          return
        }

        setAnalytics(payload)
      } catch (analyticsLoadError) {
        if (cancelled) {
          return
        }

        setAnalyticsError(
          analyticsLoadError instanceof Error
            ? analyticsLoadError.message
            : "Failed to load the timesheet analytics."
        )
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      cancelled = true
    }
  }, [activeView, analyticsUserId, bootstrap?.authenticated])

  const handleSyncProject = useCallback(async () => {
    if (!activeProjectId || syncingProject || activeView !== "sheet") {
      return
    }

    setSyncingProject(true)

    try {
      const params = new URLSearchParams({ projectId: activeProjectId })
      const response = await fetch(`/api/spreadsheet?${params.toString()}`, {
        cache: "no-store",
      })
      
      if (!response.ok) {
        throw new Error("Failed to sync project.")
      }
      
      const payload = (await response.json()) as SpreadsheetPayload

      setTasksByProjectId((current) => ({
        ...current,
        [activeProjectId]: payload.tasks ?? [],
      }))
    } catch {
      // Keep existing data if sync fails silently
    } finally {
      setSyncingProject(false)
    }
  }, [activeProjectId, syncingProject, activeView])

  const activeProject = useMemo(
    () =>
      projects.find((project) => project.id === activeProjectId) ??
      projects[0] ??
      null,
    [activeProjectId, projects]
  )

  const activeProjectTasks = activeProjectId
    ? (tasksByProjectId[activeProjectId] ?? [])
    : []

  const selectedTask = useMemo(
    () =>
      logPanelTaskId
        ? (activeProjectTasks.find((task) => task.id === logPanelTaskId) ??
          null)
        : null,
    [activeProjectTasks, logPanelTaskId]
  )

  const selectedTaskAssignees = useMemo<AssigneeOption[]>(
    () =>
      selectedTask
        ? selectedTask.assigneeIds.map((id, index) => ({
            id,
            name: selectedTask.assigneeNames[index] ?? id,
          }))
        : [],
    [selectedTask]
  )

  const activeStatusOptions = useMemo(() => {
    const optionMap = new Map<string, StatusOption>()

    for (const status of bootstrap?.metadata.statuses ?? []) {
      if (!status.projectId || status.projectId === activeProject?.id) {
        optionMap.set(status.id, status)
      }
    }

    for (const task of activeProjectTasks) {
      if (task.statusId && task.statusName && !optionMap.has(task.statusId)) {
        optionMap.set(task.statusId, {
          id: task.statusId,
          name: task.statusName,
          projectId: activeProject?.id,
        })
      }
    }

    return [...optionMap.values()].sort((left, right) =>
      left.name.localeCompare(right.name)
    )
  }, [activeProject?.id, activeProjectTasks, bootstrap?.metadata.statuses])

  const statusIdByName = useMemo(
    () =>
      new Map(activeStatusOptions.map((status) => [status.name, status.id])),
    [activeStatusOptions]
  )

  const orderedProjects = useMemo(() => {
    const pinnedOrder = new Map(
      pinnedProjectIds.map((projectId, index) => [projectId, index])
    )

    const pinnedProjects = projects
      .filter((project) => pinnedOrder.has(project.id))
      .sort(
        (left, right) =>
          (pinnedOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (pinnedOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      )

    const unpinnedProjects = projects.filter(
      (project) => !pinnedOrder.has(project.id)
    )

    return [...pinnedProjects, ...unpinnedProjects]
  }, [pinnedProjectIds, projects])

  const analyticsUserOptions = useMemo(
    () => bootstrap?.metadata.users ?? [],
    [bootstrap?.metadata.users]
  )

  const currentAnalyticsWeek = analytics?.weeks[0] ?? null

  const applyTaskLoggedMinutes = useCallback(
    (taskId: string, loggedMinutes: number) => {
      if (!activeProjectId) {
        return
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
            : task
        ),
      }))
    },
    [activeProjectId]
  )

  const fetchTaskLogs = useCallback(
    async (taskId: string) => {
      if (!activeProjectId) {
        return
      }

      setLogPanelLoading(true)
      setLogPanelError(null)

      try {
        const loadLogs = async (includeTaskId: boolean) => {
          const params = new URLSearchParams({ projectId: activeProjectId })
          if (includeTaskId) {
            params.set("taskId", taskId)
          }

          const response = await fetch(`/api/timesheet?${params.toString()}`, {
            cache: "no-store",
          })
          const payload = (await response.json()) as Array<TaskLog> & {
            message?: string
            details?: string
          }

          return { response, payload }
        }

        let { response, payload } = await loadLogs(true)

        if (
          !response.ok &&
          typeof payload?.message === "string" &&
          payload.message.includes("taskId should not exist")
        ) {
          ;({ response, payload } = await loadLogs(false))
        }

        if (!response.ok) {
          throw new Error(payload.message ?? "Failed to load task log hours.")
        }

        const logs = (Array.isArray(payload) ? payload : []).filter(
          (log) => log.taskId === taskId
        )
        setLogsByTaskId((current) => ({
          ...current,
          [taskId]: logs,
        }))
        applyTaskLoggedMinutes(
          taskId,
          logs.reduce((sum, log) => sum + log.durationMinutes, 0)
        )
      } catch (error) {
        setLogPanelError(
          error instanceof Error
            ? error.message
            : "Failed to load task log hours."
        )
      } finally {
        setLogPanelLoading(false)
      }
    },
    [activeProjectId, applyTaskLoggedMinutes]
  )

  const openLogPanel = useCallback(
    (taskId: string) => {
      const task = activeProjectTasks.find((entry) => entry.id === taskId)
      const defaultUserId = task
        ? task.assigneeIds.includes(preferredLogUserId)
          ? preferredLogUserId
          : (task.assigneeIds[task.assigneeIds.length - 1] ??
            task.assigneeIds[0] ??
            "")
        : preferredLogUserId

      setLogPanelTaskId(taskId)
      setNewLogDraft({
        date: getTodayIso(),
        durationClock: "00:30",
        userId: defaultUserId,
        billable: true,
      })
      void fetchTaskLogs(taskId)
    },
    [activeProjectTasks, fetchTaskLogs, preferredLogUserId]
  )

  const closeLogPanel = useCallback(() => {
    setLogPanelTaskId(null)
    setLogPanelError(null)
    setSavingLogIds({})
    setAddingLog(false)
  }, [])

  const handleStatusChange = useCallback(
    async (
      taskId: string,
      nextStatusName: string,
      previousStatusName: string
    ) => {
      const statusId = statusIdByName.get(nextStatusName)

      if (
        !taskId ||
        !statusId ||
        !activeProjectId ||
        nextStatusName === previousStatusName
      ) {
        return
      }

      setDataError(null)

      setTasksByProjectId((current) => ({
        ...current,
        [activeProjectId]: (current[activeProjectId] ?? []).map((task) =>
          task.id === taskId
            ? { ...task, statusId, statusName: nextStatusName }
            : task
        ),
      }))

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ statusId }),
        })
        const payload = (await response.json()) as TaskItem & {
          message?: string
          details?: string
        }

        if (!response.ok) {
          throw new Error(payload.message ?? "Failed to update status in Zoho.")
        }

        setTasksByProjectId((current) => ({
          ...current,
          [activeProjectId]: (current[activeProjectId] ?? []).map((task) =>
            task.id === taskId ? { ...task, ...payload } : task
          ),
        }))
      } catch (error) {
        setTasksByProjectId((current) => ({
          ...current,
          [activeProjectId]: (current[activeProjectId] ?? []).map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  statusId:
                    statusIdByName.get(previousStatusName) ?? task.statusId,
                  statusName: previousStatusName,
                }
              : task
          ),
        }))
        setDataError(
          error instanceof Error
            ? error.message
            : "Failed to update status in Zoho."
        )
      }
    },
    [activeProjectId, statusIdByName]
  )

  const handleLogFieldChange = useCallback(
    (
      logId: string,
      field: "date" | "durationMinutes" | "billable",
      value: string | number | boolean
    ) => {
      if (!logPanelTaskId) {
        return
      }

      setLogsByTaskId((current) => ({
        ...current,
        [logPanelTaskId]: (current[logPanelTaskId] ?? []).map((log) =>
          log.id === logId ? { ...log, [field]: value } : log
        ),
      }))
    },
    [logPanelTaskId]
  )

  const handleSaveLog = useCallback(
    async (logId: string) => {
      if (!logPanelTaskId) {
        return
      }

      const log = (logsByTaskId[logPanelTaskId] ?? []).find(
        (entry) => entry.id === logId
      )
      if (!log) {
        return
      }

      setSavingLogIds((current) => ({ ...current, [logId]: true }))
      setLogPanelError(null)

      try {
        const response = await fetch(`/api/timesheet/${logId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            date: log.date,
            durationMinutes: log.durationMinutes,
            billable: log.billable,
            notes: log.notes,
            userId: log.userId || undefined,
          }),
        })
        const payload = (await response.json()) as TaskLog & {
          message?: string
          details?: string
        }

        if (!response.ok) {
          throw new Error(
            payload.message ?? "Failed to update log hours in Zoho."
          )
        }

        setLogsByTaskId((current) => {
          const nextLogs = (current[logPanelTaskId] ?? []).map((entry) =>
            entry.id === logId ? { ...entry, ...payload } : entry
          )
          applyTaskLoggedMinutes(
            logPanelTaskId,
            nextLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0)
          )
          return {
            ...current,
            [logPanelTaskId]: nextLogs,
          }
        })
      } catch (error) {
        setLogPanelError(
          error instanceof Error
            ? error.message
            : "Failed to update log hours in Zoho."
        )
      } finally {
        setSavingLogIds((current) => ({ ...current, [logId]: false }))
      }
    },
    [applyTaskLoggedMinutes, logPanelTaskId, logsByTaskId]
  )

  const handleAddLog = useCallback(async () => {
    if (!selectedTask) {
      return
    }

    const durationMinutes = parseClockToMinutes(newLogDraft.durationClock)
    if (durationMinutes === null || durationMinutes <= 0) {
      setLogPanelError("Enter log hours in HH:MM format.")
      return
    }

    setAddingLog(true)
    setLogPanelError(null)

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}/logs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          date: newLogDraft.date,
          durationMinutes,
          userId: newLogDraft.userId || undefined,
          billable: newLogDraft.billable,
          notes: "",
        }),
      })
      const payload = (await response.json()) as {
        message?: string
        details?: string
      }

      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to add log hours to Zoho.")
      }

      setNewLogDraft({
        date: getTodayIso(),
        durationClock: "00:30",
        userId: newLogDraft.userId,
        billable: true,
      })
      if (newLogDraft.userId) {
        setPreferredLogUserId(newLogDraft.userId)
        setAnalyticsUserId((current) => current || newLogDraft.userId)
      }
      await fetchTaskLogs(selectedTask.id)
    } catch (error) {
      setLogPanelError(
        error instanceof Error
          ? error.message
          : "Failed to add log hours to Zoho."
      )
    } finally {
      setAddingLog(false)
    }
  }, [fetchTaskLogs, newLogDraft, selectedTask])

  const taskRows = useMemo<GridRow[]>(
    () =>
      activeProjectTasks.map((task) => ({
        id: task.id,
        itemNo: Number(task.itemNo),
        name: task.name,
        statusId: task.statusId,
        statusName: task.statusName,
        priorityName: task.priorityName ?? "",
        assigneeNames: task.assigneeNames.join(", "),
        sprintName: task.sprintName ?? "",
        dueDate:
          task.dueDate && task.dueDate !== "-1"
            ? formatIsoDate(task.dueDate)
            : null,
        loggedMinutes: task.loggedMinutes,
      })),
    [activeProjectTasks]
  )

  const columnDefs = useMemo<ColDef<GridRow>[]>(
    () => [
      {
        field: "itemNo",
        headerName: "Item",
        minWidth: 110,
        maxWidth: 140,
        filter: "agNumberColumnFilter",
      },
      {
        field: "id",
        headerName: "Task ID",
        minWidth: 190,
        filter: "agTextColumnFilter",
      },
      {
        field: "name",
        headerName: "Title",
        minWidth: 260,
        flex: 1.8,
        filter: "agTextColumnFilter",
      },
      {
        field: "statusName",
        headerName: "Status",
        minWidth: 220,
        filter: "agTextColumnFilter",
        cellRenderer: (params: {
          data?: GridRow
          value?: string | number | null
        }) => {
          const taskId = String(params.data?.id ?? "")
          const currentValue =
            typeof params.value === "string"
              ? params.value
              : String(params.value ?? "")

          return (
            <select
              value={currentValue}
              disabled={!taskId || activeStatusOptions.length === 0}
              onChange={(event) =>
                void handleStatusChange(
                  taskId,
                  event.target.value,
                  currentValue
                )
              }
              className="block h-7 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-sm text-slate-700 outline-none focus:outline-none"
            >
              {activeStatusOptions.map((status) => (
                <option key={status.id} value={status.name}>
                  {status.name}
                </option>
              ))}
            </select>
          )
        },
      },
      {
        field: "priorityName",
        headerName: "Priority",
        minWidth: 130,
        filter: "agTextColumnFilter",
      },
      {
        field: "assigneeNames",
        headerName: "Assignees",
        minWidth: 180,
        filter: "agTextColumnFilter",
      },
      {
        field: "sprintName",
        headerName: "Sprint",
        minWidth: 180,
        filter: "agTextColumnFilter",
      },
      {
        field: "dueDate",
        headerName: "Due date",
        minWidth: 130,
        filter: "agDateColumnFilter",
        filterParams: dateFilterParams,
        valueFormatter: (params) =>
          formatIsoDate(params.value as string | null),
      },
      {
        field: "loggedMinutes",
        headerName: "Log Hours",
        minWidth: 190,
        filter: "agNumberColumnFilter",
        cellRenderer: (params: {
          data?: GridRow
          value?: string | number | null
        }) => {
          const taskId = String(params.data?.id ?? "")
          const loggedMinutes =
            typeof params.value === "number"
              ? params.value
              : Number(params.value ?? 0)

          return (
            <button
              type="button"
              onClick={() => taskId && openLogPanel(taskId)}
              className="inline-flex h-7 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              <Clock3 className="h-3.5 w-3.5" />
              {formatMinutesAsClock(loggedMinutes)}
            </button>
          )
        },
      },
    ],
    [activeStatusOptions, handleStatusChange, openLogPanel]
  )

  const handleTogglePinnedProject = (projectId: string) => {
    setPinnedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((entry) => entry !== projectId)
        : [projectId, ...current]
    )
  }

  const formulaText =
    activeView === "analytics"
      ? analyticsLoading
        ? "Loading timesheet analytics..."
        : analytics
          ? `${
              analytics.userName ?? "Current Zoho user"
            } | ${formatMinutesAsClock(
              currentAnalyticsWeek?.loggedMinutes ?? analytics.totalLoggedMinutes
            )} logged | ${formatMinutesAsClock(
              currentAnalyticsWeek?.missingMinutes ?? 0
            )} still missing this week`
          : "Timesheet analytics"
      : activeProject
        ? `${activeProject.name} | ${taskRows.length} items`
        : loading || tasksLoading
          ? "Loading projects..."
          : "No project selected"

  const loginHref = bootstrap?.authUrl ?? LOCALHOST_LOGIN_URL
  const userInitial = getUserInitial(
    bootstrap?.currentUser?.displayName,
    bootstrap?.currentUser?.email
  )

  const selectedTaskLogs = selectedTask
    ? (logsByTaskId[selectedTask.id] ?? [])
    : []

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-base font-medium text-gray-600">
            Syncing data from Zoho...
          </p>
        </div>
      </main>
    )
  }

  if (!bootstrap?.authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-900">
        <a
          href={loginHref}
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold tracking-tight text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          <span aria-hidden="true" className="inline-flex items-center gap-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#e42527] text-[8px] leading-none font-bold text-white">
              Z
            </span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#159b48] text-[8px] leading-none font-bold text-white">
              O
            </span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#1f70c1] text-[8px] leading-none font-bold text-white">
              H
            </span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#f4af1d] text-[8px] leading-none font-bold text-white">
              O
            </span>
          </span>
          <span className="h-5 w-px bg-slate-200" />
          <span className="whitespace-nowrap">Continue with Zoho</span>
        </a>
      </main>
    )
  }

  return (
    <>
      <main className="flex h-screen w-screen flex-col overflow-hidden bg-white font-sans text-sm">
        <header className="flex h-16 w-full items-center justify-between border-b border-gray-200 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-green-100 text-green-700">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg leading-tight font-medium text-gray-800">
                {activeView === "analytics"
                  ? "Timesheet Analytics"
                  : (activeProject?.name ?? "Project sheet")}
              </h1>
              <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView("sheet")
                  }}
                  className={`rounded px-2 py-0.5 transition ${
                    activeView === "sheet"
                      ? "bg-sky-100 font-semibold text-sky-700"
                      : "cursor-pointer hover:bg-gray-100"
                  }`}
                >
                  Sheet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogPanelTaskId(null)
                    setLogPanelError(null)
                    setActiveView("analytics")
                  }}
                  className={`rounded px-2 py-0.5 transition ${
                    activeView === "analytics"
                      ? "bg-sky-100 font-semibold text-sky-700"
                      : "cursor-pointer hover:bg-gray-100"
                  }`}
                >
                  Analytics
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {activeView === "analytics" && (
              <div className="flex items-center gap-4">
                <GreythrIntegration realtime={greythrRealtime} />
                <div className="h-6 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Track user</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                    <select
                      value={analyticsUserId}
                      onChange={(event) => setAnalyticsUserId(event.target.value)}
                      className="h-8 w-40 lg:w-48 rounded border border-gray-300 bg-white pr-7 pl-8 text-xs text-gray-900 outline-none transition focus:border-blue-500 appearance-none"
                    >
                      <option value="">Use current Zoho user</option>
                      {analyticsUserOptions.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <RefreshCw 
              onClick={handleSyncData}
              className={`h-5 w-5 cursor-pointer text-gray-600 hover:text-blue-600 transition-transform ${syncingProject ? 'animate-spin text-blue-600' : ''}`} 
            />
            <MessageSquare className="h-5 w-5 cursor-pointer text-gray-600" />
            <MoreVertical className="h-5 w-5 cursor-pointer text-gray-600" />
            <div className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-blue-100 px-5 font-medium text-blue-700 hover:bg-blue-200">
              <Share className="h-4 w-4" />
              Share
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 font-bold text-white"
              >
                {userInitial}
              </button>
              {userMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white py-2 shadow-lg">
                  <div className="px-4 py-3 text-sm text-slate-900">
                    {bootstrap.currentUser?.displayName ||
                      bootstrap.currentUser?.email ||
                      "Unknown user"}
                  </div>
                  <div className="border-t border-slate-200" />
                  <a
                    href={LOCALHOST_DISCONNECT_URL}
                    className="block px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                  >
                    Logout
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex h-9 w-full min-w-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 text-gray-600">
          <div className="border-r border-gray-300 pr-2 font-mono text-xs text-gray-500">
            fx
          </div>
          <div className="min-w-0 flex-1 truncate text-sm">{formulaText}</div>
        </div>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-w-0 flex-1 overflow-hidden">
              {activeView === "analytics" ? (
                <TimesheetAnalytics
                  analytics={analytics}
                  loading={analyticsLoading}
                  error={dataError}
                  availableUsers={analyticsUserOptions}
                  selectedUserId={analyticsUserId}
                  greythrDataMap={greythrDataMap}
                  onUserChange={setAnalyticsUserId}
                  onBackToSheets={() => setActiveView("sheet")}
                />
              ) : dataError ? (
                <div className="flex h-full items-center justify-center bg-white px-6 text-center">
                  <div>
                    <div className="text-base font-medium text-gray-800">
                      Unable to load real project data
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {dataError}
                    </div>
                  </div>
                </div>
              ) : tasksLoading &&
                !(activeProject?.id && activeProject.id in tasksByProjectId) ? (
                <div className="flex h-full items-center justify-center bg-white px-6 text-center">
                  <div>
                    <div className="text-base font-medium text-gray-800">
                      Loading {activeProject?.name ?? "project"} tab
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Fetching only this tab&apos;s tasks to keep the dashboard
                      fast.
                    </div>
                  </div>
                </div>
              ) : (
                <GridSpace
                  key={activeProject?.id ?? "grid"}
                  rowData={taskRows}
                  columnDefs={columnDefs}
                  filterStorageKey={
                    activeProject
                      ? `zoho-power-grid:filters:${activeProject.id}`
                      : null
                  }
                  columnStorageKey="zoho-power-grid:columns-state"
                />
              )}
            </div>
            {activeView === "sheet" ? (
              <BottomTabBar
                sheets={orderedProjects.map((project) => ({
                  id: project.id,
                  name: project.name,
                }))}
                activeSheetId={activeProject?.id ?? ""}
                onSheetChange={setActiveProjectId}
                pinnedSheetIds={pinnedProjectIds}
                onTogglePin={handleTogglePinnedProject}
              />
            ) : null}
          </div>
          {selectedTask && activeView === "sheet" ? (
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
        </div>
      </main>
    </>
  )
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
  task: TaskItem
  logs: TaskLog[]
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => void
  onLogFieldChange: (
    logId: string,
    field: "date" | "durationMinutes" | "billable",
    value: string | number | boolean
  ) => void
  onSaveLog: (logId: string) => void
  savingLogIds: Record<string, boolean>
  assigneeOptions: AssigneeOption[]
  newLogDraft: NewLogDraft
  setNewLogDraft: React.Dispatch<React.SetStateAction<NewLogDraft>>
  onAddLog: () => void
  addingLog: boolean
}) {
  const groupedLogs = useMemo(() => {
    const groups = new Map<string, TaskLog[]>()

    for (const log of logs) {
      const dateKey = log.date
      const existing = groups.get(dateKey) ?? []
      existing.push(log)
      groups.set(dateKey, existing)
    }

    return [...groups.entries()]
      .sort((left, right) => right[0].localeCompare(left[0]))
      .map(([date, entries]) => ({
        date,
        totalMinutes: entries.reduce(
          (sum, entry) => sum + entry.durationMinutes,
          0
        ),
        entries,
      }))
  }, [logs])

  const totalLoggedMinutes = logs.reduce(
    (sum, log) => sum + log.durationMinutes,
    0
  )

  return (
    <div className="flex w-[480px] shrink-0 flex-col border-l border-gray-300 bg-white font-sans text-sm">
      <div className="flex flex-col border-b border-gray-200">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="truncate text-base font-medium text-gray-800">
              Log Hours
            </h2>
            <div className="mt-1 truncate text-sm text-gray-600">
              {task.name}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {task.projectName} • Total logged: {formatMinutesAsClock(totalLoggedMinutes)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col border-b border-gray-200 bg-gray-50 px-5 py-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Date</span>
            <input
              type="date"
              value={newLogDraft.date}
              onChange={(event) =>
                setNewLogDraft((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
              className="h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Time (HH:MM)</span>
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
              className="h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">User</span>
            <select
              value={newLogDraft.userId}
              onChange={(event) =>
                setNewLogDraft((current) => ({
                  ...current,
                  userId: event.target.value,
                }))
              }
              className="h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={newLogDraft.billable}
              onChange={(event) =>
                setNewLogDraft((current) => ({
                  ...current,
                  billable: event.target.checked,
                }))
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Billable
          </label>
          <button
            type="button"
            onClick={onAddLog}
            disabled={addingLog}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {addingLog ? "Saving..." : "Add log"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-2">
          <span className="text-xs font-medium tracking-wider text-gray-500 uppercase">
            History
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Loading log history...
            </div>
          ) : groupedLogs.length > 0 ? (
            <div className="space-y-6">
              {groupedLogs.map((group) => (
                <div key={group.date} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                    <span>{formatHumanDate(group.date)}</span>
                    <span>{formatMinutesAsClock(group.totalMinutes)} logged</span>
                  </div>
                  <div className="flex flex-col divide-y divide-gray-100 rounded border border-gray-200">
                    {group.entries.map((log) => (
                      <div key={log.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="date"
                            value={log.date}
                            onChange={(event) =>
                              onLogFieldChange(log.id, "date", event.target.value)
                            }
                            className="h-8 flex-1 rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="time"
                            step={300}
                            value={formatMinutesAsClock(log.durationMinutes)}
                            onChange={(event) => {
                              const nextMinutes = parseClockToMinutes(event.target.value)
                              if (nextMinutes !== null) {
                                onLogFieldChange(log.id, "durationMinutes", nextMinutes)
                              }
                            }}
                            className="h-8 w-24 rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={log.billable}
                              onChange={(event) =>
                                onLogFieldChange(log.id, "billable", event.target.checked)
                              }
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Billable
                          </label>
                          <button
                            type="button"
                            onClick={() => onSaveLog(log.id)}
                            disabled={Boolean(savingLogIds[log.id])}
                            className="inline-flex h-7 items-center justify-center rounded border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {savingLogIds[log.id] ? "Saving..." : "Update"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">
              No log hours recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

