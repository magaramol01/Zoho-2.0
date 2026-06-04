"use client"

import { useMemo, type ReactNode } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  LayoutGrid,
  TrendingDown,
  TrendingUp,
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
  greythrDataMap,
  onUserChange,
  onBackToSheets,
}: {
  analytics: TimesheetAnalyticsSummary | null
  loading: boolean
  error: string | null
  availableUsers: AnalyticsUserOption[]
  selectedUserId: string
  greythrDataMap: Record<string, string>
  onUserChange: (userId: string) => void
  onBackToSheets: () => void
}) {
  const currentWeek = analytics?.weeks[0] ?? null
  const totalAttentionDays = analytics?.attentionDays.length ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50 font-sans text-sm">
      <div className="mx-auto flex w-full flex-1 min-h-0 flex-col gap-6 px-4 py-6 md:px-8 lg:px-10">


        {error ? (
          <div className="shrink-0 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="text-sm font-medium text-gray-500">
                Syncing timesheet data...
              </p>
            </div>
          </div>
        ) : analytics ? (
          <>
            <section className="shrink-0 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              <SummaryCard
                title="Tracking"
                value={
                  availableUsers.find((u) => u.id === selectedUserId)?.name ||
                  "Current User"
                }
                helper={`User ID ${selectedUserId}`}
                icon={<UserRound className="h-4 w-4" />}
              />
              <SummaryCard
                title="This week"
                value={formatMinutesAsClock(currentWeek?.loggedMinutes ?? 0)}
                helper={`${formatMinutesAsClock(currentWeek?.targetMinutes ?? 0)} expected so far`}
                icon={<Clock className="h-4 w-4" />}
              />
              <SummaryCard
                title="Still missing"
                value={formatMinutesAsClock(
                  analytics.weeks.reduce(
                    (acc, w) => acc + w.missingMinutes,
                    0
                  )
                )}
                helper={`${totalAttentionDays} weekday(s) below policy`}
                icon={<AlertCircle className="h-4 w-4" />}
                isError={totalAttentionDays > 0}
              />
              <SummaryCard
                title="Weeks checked"
                value={analytics.weeks.length.toString()}
                helper={`${analytics.includedLogsCount} matched log entries in this window`}
                icon={<Calendar className="h-4 w-4" />}
              />
            </section>

            {analytics.includedUnknownOwnerLogs > 0 ? (
              <section className="shrink-0 rounded border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">
                      Unowned Logs Detected
                    </h3>
                    <div className="mt-1 text-xs text-blue-800">
                      We found {analytics.includedUnknownOwnerLogs} logs that in
                      this range still do not expose a user owner.
                      {analytics.includedUnknownOwnerLogs
                        ? " They are currently counted because this view is tracking the active Zoho user."
                        : " They are not counted for the selected person yet, so refreshing after the next Zoho sync can improve accuracy."}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="flex-1 min-h-0 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex flex-col min-h-0">
                <div className="shrink-0 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Weekly Breakdown
                </div>
                <div className="flex-1 overflow-y-auto pr-2 sheet-panel-scrollbar space-y-5">
                  {analytics.weeks.map((week) => {
                    const progressPercentage = week.targetMinutes > 0
                      ? Math.min(100, Math.round((week.loggedMinutes / week.targetMinutes) * 100))
                      : 0

                    return (
                      <article
                        key={week.weekStart}
                        className="rounded border border-gray-300 bg-white shadow-sm overflow-hidden"
                      >
                        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                              Week {week.label.split("·")[0].replace("Week", "").trim()}
                            </div>
                            <div className="text-lg font-semibold text-gray-900 leading-tight">
                              {week.label.split("·")[1]?.trim()}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {week.filledDays} full days · {week.partialDays} partial · {week.emptyDays} empty
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                              Logged {formatMinutesAsClock(week.loggedMinutes)}
                            </span>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                              Target {formatMinutesAsClock(week.targetMinutes)}
                            </span>
                            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                              Missing {formatMinutesAsClock(week.missingMinutes)}
                            </span>
                          </div>
                        </div>

                        <div className="px-5 pb-4">
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="w-16">Progress</div>
                            <div className="relative flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`absolute top-0 left-0 h-full ${progressPercentage >= 100 ? "bg-green-500" : progressPercentage > 0 ? "bg-orange-500" : "bg-red-500"}`}
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                            <div className="w-8 text-right font-medium">{progressPercentage}%</div>
                          </div>
                        </div>

                        <div className="border-t border-gray-200">
                          <div className="flex overflow-x-auto sheet-panel-scrollbar">
                            {week.days.map((day, index) => (
                              <div
                                key={day.date}
                                className={`flex-none w-48 p-4 shrink-0 transition-colors ${index !== week.days.length - 1 ? "border-r border-gray-200" : ""} ${day.status === "weekend" ? "bg-gray-50/50" : "bg-white"}`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <div className="text-[10px] font-semibold text-gray-500 uppercase">
                                    {day.dayLabel}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {formatDate(day.date).slice(0, 6)}
                                  </div>
                                </div>

                                <div className="mb-2">
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                      day.status === "partial" || day.status === "empty"
                                        ? "bg-blue-50 text-blue-700"
                                        : day.status === "weekend" || day.status === "upcoming"
                                        ? "bg-gray-100 text-gray-500"
                                        : day.status === "over"
                                        ? "bg-purple-50 text-purple-700"
                                        : "bg-green-50 text-green-700"
                                    }`}
                                  >
                                    {getStatusLabel(day)}
                                  </span>
                                </div>

                                <div className="mt-1 mb-4">
                                  <div className="text-2xl font-bold text-gray-900">
                                    {formatMinutesAsClock(day.loggedMinutes)}
                                  </div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    Target {formatMinutesAsClock(day.targetMinutes)}
                                  </div>
                                  <div className="mt-0.5 h-4">
                                    {day.status === "partial" || day.status === "empty" ? (
                                      <div className="text-[10px] font-bold text-red-700">
                                        Need {formatMinutesAsClock(day.missingMinutes)} more
                                      </div>
                                    ) : day.status === "over" ? (
                                      <div className="text-[10px] font-bold text-purple-700">
                                        Over by {formatMinutesAsClock(day.loggedMinutes - day.targetMinutes)}
                                      </div>
                                    ) : day.status === "upcoming" ? (
                                      null
                                    ) : day.status === "filled" ? (
                                      <div className="text-[10px] font-bold text-green-700">Target met</div>
                                    ) : null}
                                  </div>
                                </div>
                                
                                {(() => {
                                  const greythrTime = greythrDataMap[day.date];
                                  if (!greythrTime) return null;
                                  
                                  let greythrMins = 0;
                                  if (greythrTime.includes(":")) {
                                    const parts = greythrTime.split(":");
                                    greythrMins = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                                  } else if (!isNaN(Number(greythrTime))) {
                                    greythrMins = Number(greythrTime);
                                  }
                                  
                                  const diff = greythrMins - day.loggedMinutes;
                                  const diffFormatted = formatMinutesAsClock(Math.abs(diff));
                                  
                                  return (
                                    <div className="mt-3 border-t border-gray-100 pt-3">
                                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                                        GreytHR Time
                                      </div>
                                      <div className="text-sm font-semibold text-gray-800">
                                        {formatMinutesAsClock(greythrMins)}
                                      </div>
                                      <div className={`text-[10px] font-bold mt-0.5 ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        Diff: {diff > 0 ? "+" : diff < 0 ? "-" : ""}{diffFormatted}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {day.projects.length ? (
                                  <div className="mt-3 space-y-1">
                                    {day.projects.slice(0, 3).map((project) => (
                                      <div
                                        key={`${day.date}-${project.projectId}`}
                                        className="flex items-center justify-between gap-1 rounded bg-gray-100 px-1.5 py-1 text-[9px] text-gray-600"
                                      >
                                        <span className="truncate">
                                          {project.projectName}
                                        </span>
                                        <span className="shrink-0 font-medium">
                                          - {formatMinutesAsClock(project.durationMinutes)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              <aside className="space-y-4 pt-8 overflow-y-auto pr-2 sheet-panel-scrollbar pb-8">
                <article className="rounded border border-gray-300 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
                    </span>
                    <h3 className="font-bold text-gray-800 text-sm">Action required</h3>
                  </div>
                  <div className="border-t border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-500">Days that are twice below the 8-hour policy.</p>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {totalAttentionDays ? (
                      analytics.attentionDays.slice(0, 12).map((day) => (
                        <div
                          key={`attention-${day.date}`}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <div className="text-[13px] font-bold text-gray-900">
                              {formatDate(day.date)}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              Logged {formatMinutesAsClock(day.loggedMinutes)} of{" "}
                              {formatMinutesAsClock(day.targetMinutes)}
                            </div>
                          </div>
                          <div className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                            Need {formatMinutesAsClock(day.missingMinutes)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-xs text-green-700 font-medium bg-green-50 border-t border-gray-200">
                        All tracked weekdays meet the target!
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded border border-gray-300 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                    </span>
                    <h3 className="font-bold text-gray-800 text-sm">Coverage snapshot</h3>
                  </div>
                  
                  <div className="border-t border-gray-200 px-4 py-4 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total logged in range</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatMinutesAsClock(
                        analytics.weeks.reduce((acc, week) => acc + week.loggedMinutes, 0)
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 px-4 py-4 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Expected per workday</div>
                    <div className="text-xl font-bold text-gray-900">08:00</div>
                  </div>
                  
                  <div className="border-t border-gray-200 px-4 py-2 text-center">
                    <span className="text-[10px] text-gray-400">
                      Generated · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </article>
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
    <div className="rounded border border-gray-300 bg-white p-4 shadow-sm flex flex-col justify-between min-h-[110px]">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <span className="text-gray-500">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-auto">
        <div className="text-2xl font-bold text-gray-900 leading-none mb-1.5">
          {value}
        </div>
        <div className="text-[11px] text-gray-500">{helper}</div>
      </div>
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
