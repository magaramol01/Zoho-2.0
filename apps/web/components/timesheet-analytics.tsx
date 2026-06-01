"use client"

import type { ReactNode } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  UserRound,
} from "lucide-react"

export type AnalyticsUserOption = {
  id: string
  name: string
}

export type TimesheetAnalyticsDayStatus =
  | "upcoming"
  | "empty"
  | "partial"
  | "filled"
  | "over"
  | "weekend"

export type TimesheetAnalyticsProjectBreakdown = {
  projectId: string
  projectName: string
  durationMinutes: number
}

export type TimesheetAnalyticsDay = {
  date: string
  dayLabel: string
  isWeekend: boolean
  isFuture: boolean
  loggedMinutes: number
  targetMinutes: number
  missingMinutes: number
  entryCount: number
  projectCount: number
  status: TimesheetAnalyticsDayStatus
  projects: TimesheetAnalyticsProjectBreakdown[]
}

export type TimesheetAnalyticsWeek = {
  weekStart: string
  weekEnd: string
  label: string
  loggedMinutes: number
  targetMinutes: number
  missingMinutes: number
  trackedWorkdayCount: number
  filledDays: number
  partialDays: number
  emptyDays: number
  overDays: number
  days: TimesheetAnalyticsDay[]
}

export type TimesheetAnalyticsSummary = {
  userId: string | null
  userName: string | null
  generatedAt: string
  expectedMinutesPerWorkday: number
  selectedWeekCount: number
  matchedLogCount: number
  logsWithoutOwnerCount: number
  includedUnknownOwnerLogs: boolean
  totalLoggedMinutes: number
  attentionDays: TimesheetAnalyticsDay[]
  weeks: TimesheetAnalyticsWeek[]
}

const statusChipClasses: Record<TimesheetAnalyticsDayStatus, string> = {
  upcoming: "bg-gray-100 text-gray-500",
  empty: "bg-red-100 text-red-700",
  partial: "bg-orange-100 text-orange-800",
  filled: "bg-green-100 text-green-800",
  over: "bg-blue-100 text-blue-800",
  weekend: "bg-gray-100 text-gray-600",
}

const statusPanelClasses: Record<TimesheetAnalyticsDayStatus, string> = {
  upcoming: "border-gray-200 bg-white",
  empty: "border-red-200 bg-red-50",
  partial: "border-orange-200 bg-orange-50",
  filled: "border-green-200 bg-green-50",
  over: "border-blue-200 bg-blue-50",
  weekend: "border-gray-200 bg-gray-50",
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

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getStatusLabel(day: TimesheetAnalyticsDay) {
  switch (day.status) {
    case "filled":
      return "Filled"
    case "over":
      return "Over"
    case "partial":
      return "Partial"
    case "empty":
      return "Missing"
    case "weekend":
      return "Weekend"
    case "upcoming":
      return "Upcoming"
    default:
      return "Tracked"
  }
}

export default function TimesheetAnalytics({
  analytics,
  loading,
  error,
  availableUsers,
  selectedUserId,
  onUserChange,
  onBackToSheets,
}: {
  analytics: TimesheetAnalyticsSummary | null
  loading: boolean
  error: string | null
  availableUsers: AnalyticsUserOption[]
  selectedUserId: string
  onUserChange: (userId: string) => void
  onBackToSheets: () => void
}) {
  const currentWeek = analytics?.weeks[0] ?? null
  const totalAttentionDays = analytics?.attentionDays.length ?? 0

  return (
    <div className="sheet-panel-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-gray-50 font-sans text-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
        <section className="rounded border border-gray-300 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <button
                type="button"
                onClick={onBackToSheets}
                className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to project sheet
              </button>
              <div>
                <h2 className="mt-3 text-xl font-semibold text-gray-900">
                  Timesheet Analytics
                </h2>
                <p className="mt-1 max-w-3xl text-xs text-gray-600">
                  Daily 8-hour view combining Zoho-synced log hours and locally added logs. Highlights missing or incomplete time entries.
                </p>
              </div>
            </div>

            <label className="flex w-full max-w-sm flex-col gap-1 text-xs text-gray-600">
              <span className="font-medium">Track user</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedUserId}
                  onChange={(event) => onUserChange(event.target.value)}
                  className="h-9 w-full rounded border border-gray-300 bg-white pr-4 pl-9 text-sm text-gray-900 outline-none transition focus:border-blue-500"
                >
                  <option value="">Use current Zoho user</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>
        </section>

        {error ? (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded border border-gray-200 bg-white"
              />
            ))}
          </div>
        ) : null}

        {!loading && analytics ? (
          <>
            <section className="grid gap-4 xl:grid-cols-4">
              <SummaryCard
                icon={<UserRound className="h-4 w-4" />}
                label="Tracking"
                value={analytics.userName ?? "Current Zoho user"}
                helper={
                  analytics.userId
                    ? `User ID ${analytics.userId}`
                    : "Using the current authenticated Zoho profile"
                }
              />
              <SummaryCard
                icon={<Clock3 className="h-4 w-4" />}
                label="This week"
                value={
                  currentWeek
                    ? formatMinutesAsClock(currentWeek.loggedMinutes)
                    : "00:00"
                }
                helper={
                  currentWeek
                    ? `${formatMinutesAsClock(currentWeek.targetMinutes)} expected so far`
                    : "No week data yet"
                }
              />
              <SummaryCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Still missing"
                value={
                  currentWeek
                    ? formatMinutesAsClock(currentWeek.missingMinutes)
                    : "00:00"
                }
                helper={
                  currentWeek
                    ? `${currentWeek.partialDays + currentWeek.emptyDays} weekday(s) below policy`
                    : "Nothing to review"
                }
              />
              <SummaryCard
                icon={<CalendarRange className="h-4 w-4" />}
                label="Weeks checked"
                value={String(analytics.selectedWeekCount)}
                helper={`${analytics.matchedLogCount} matched log entries in this window`}
              />
            </section>

            {analytics.logsWithoutOwnerCount > 0 ? (
              <section className="rounded border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                  <div>
                    <div className="font-semibold">Owner data is still syncing for some rows.</div>
                    <div className="mt-1 text-xs">
                      {analytics.logsWithoutOwnerCount} log entr
                      {analytics.logsWithoutOwnerCount === 1 ? "y" : "ies"} in
                      this range still do not expose a user owner.
                      {analytics.includedUnknownOwnerLogs
                        ? " They are currently counted because this view is tracking the active Zoho user."
                        : " They are not counted for the selected person yet, so refreshing after the next Zoho sync can improve accuracy."}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                {analytics.weeks.map((week) => (
                  <article
                    key={week.weekStart}
                    className="rounded border border-gray-300 bg-white shadow-sm"
                  >
                    <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {week.label}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {week.filledDays} full day
                          {week.filledDays === 1 ? "" : "s"}, {week.partialDays} partial,{" "}
                          {week.emptyDays} empty
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-white px-2 py-1 font-medium border border-gray-200 text-gray-700">
                          Logged {formatMinutesAsClock(week.loggedMinutes)}
                        </span>
                        <span className="rounded bg-white px-2 py-1 font-medium border border-gray-200 text-blue-700">
                          Target {formatMinutesAsClock(week.targetMinutes)}
                        </span>
                        <span className="rounded bg-white px-2 py-1 font-medium border border-gray-200 text-red-700">
                          Missing {formatMinutesAsClock(week.missingMinutes)}
                        </span>
                      </div>
                    </div>

                    <div className="grid divide-y divide-gray-200 md:grid-cols-2 md:divide-y-0 md:divide-x xl:grid-cols-7">
                      {week.days.map((day) => (
                        <div
                          key={day.date}
                          className={`p-3 transition-colors ${statusPanelClasses[day.status]}`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="text-[10px] font-semibold text-gray-500 uppercase">
                                {day.dayLabel}
                              </div>
                              <div className="text-xs font-semibold text-gray-900">
                                {formatDate(day.date)}
                              </div>
                            </div>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusChipClasses[day.status]}`}
                            >
                              {getStatusLabel(day)}
                            </span>
                          </div>

                          <div className="mt-3">
                            <div className="text-xl font-bold text-gray-900">
                              {formatMinutesAsClock(day.loggedMinutes)}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Target {formatMinutesAsClock(day.targetMinutes)}
                            </div>
                          </div>

                          <div className="mt-2 text-[11px] leading-tight text-gray-600">
                            {day.status === "partial" || day.status === "empty" ? (
                              <span className="text-red-700 font-medium">
                                Need {formatMinutesAsClock(day.missingMinutes)} more
                              </span>
                            ) : day.status === "over" ? (
                              <span className="text-blue-700 font-medium">
                                Over by{" "}
                                {formatMinutesAsClock(
                                  day.loggedMinutes - day.targetMinutes
                                )}
                              </span>
                            ) : day.status === "weekend" ? (
                              <span>Weekend</span>
                            ) : day.status === "upcoming" ? (
                              <span>Upcoming</span>
                            ) : (
                              <span className="text-green-700 font-medium">Target covered</span>
                            )}
                          </div>

                          {day.projects.length ? (
                            <div className="mt-3 space-y-1">
                              {day.projects.slice(0, 3).map((project) => (
                                <div
                                  key={`${day.date}-${project.projectId}`}
                                  className="flex items-center justify-between gap-2 rounded bg-white/60 px-2 py-1 text-[10px] text-gray-700"
                                >
                                  <span className="truncate">
                                    {project.projectName}
                                  </span>
                                  <span className="shrink-0 font-medium text-gray-900">
                                    {formatMinutesAsClock(project.durationMinutes)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <aside className="space-y-4">
                <section className="rounded border border-gray-300 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Action Required
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Days that are below the 8-hour policy.
                  </p>

                  <div className="mt-3 space-y-2">
                    {totalAttentionDays ? (
                      analytics.attentionDays.slice(0, 12).map((day) => (
                        <div
                          key={`attention-${day.date}`}
                          className="rounded border border-red-200 bg-red-50 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-gray-900">
                                {formatDate(day.date)}
                              </div>
                              <div className="text-[10px] text-gray-600">
                                Logged {formatMinutesAsClock(day.loggedMinutes)} of{" "}
                                {formatMinutesAsClock(day.targetMinutes)}
                              </div>
                            </div>
                            <div className="text-xs font-bold text-red-700">
                              Need {formatMinutesAsClock(day.missingMinutes)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                        All tracked weekdays meet the target!
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded border border-gray-300 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Clock3 className="h-4 w-4 text-blue-600" />
                    Coverage Snapshot
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-gray-700">
                    <MetricLine
                      label="Total logged in range"
                      value={formatMinutesAsClock(analytics.totalLoggedMinutes)}
                    />
                    <MetricLine
                      label="Expected per workday"
                      value={formatMinutesAsClock(
                        analytics.expectedMinutesPerWorkday
                      )}
                    />
                    <MetricLine
                      label="Generated"
                      value={new Date(analytics.generatedAt).toLocaleString(
                        "en-GB",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }
                      )}
                    />
                  </div>
                </section>
              </aside>
            </section>
          </>
        ) : null}

        {!loading && !analytics && !error ? (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
            No analytics data loaded.
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded border border-gray-300 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-700">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold text-gray-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-500">{helper}</div>
    </div>
  )
}

function MetricLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded bg-gray-50 px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  )
}
