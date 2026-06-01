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
  upcoming: "bg-slate-100 text-slate-500",
  empty: "bg-rose-100 text-rose-700",
  partial: "bg-amber-100 text-amber-800",
  filled: "bg-emerald-100 text-emerald-800",
  over: "bg-sky-100 text-sky-800",
  weekend: "bg-slate-100 text-slate-600",
}

const statusPanelClasses: Record<TimesheetAnalyticsDayStatus, string> = {
  upcoming: "border-slate-200 bg-white",
  empty: "border-rose-200 bg-rose-50/70",
  partial: "border-amber-200 bg-amber-50/70",
  filled: "border-emerald-200 bg-emerald-50/80",
  over: "border-sky-200 bg-sky-50/80",
  weekend: "border-slate-200 bg-slate-50",
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
    <div className="sheet-panel-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#f8fafc_24%,#f1f5f9_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 md:px-6">
        <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <button
                type="button"
                onClick={onBackToSheets}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to project sheet
              </button>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Analytics
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                  Daily 8-hour view across every synced project.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  This screen combines Zoho-synced log hours and locally added
                  logs, then highlights which weekdays are complete, short, or
                  still missing time.
                </p>
              </div>
            </div>

            <label className="flex w-full max-w-sm flex-col gap-2 text-sm text-slate-600">
              <span className="font-medium">Track user</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedUserId}
                  onChange={(event) => onUserChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-300 bg-white pr-4 pl-10 text-slate-900 outline-none transition focus:border-sky-500"
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
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-[24px] border border-slate-200 bg-white/80"
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
              <section className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Owner data is still syncing for some rows.</div>
                    <div className="mt-1 leading-6">
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
                    className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-950">
                          {week.label}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {week.filledDays} full day
                          {week.filledDays === 1 ? "" : "s"}, {week.partialDays} partial,{" "}
                          {week.emptyDays} empty
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          Logged {formatMinutesAsClock(week.loggedMinutes)}
                        </span>
                        <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-800">
                          Target {formatMinutesAsClock(week.targetMinutes)}
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                          Missing {formatMinutesAsClock(week.missingMinutes)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                      {week.days.map((day) => (
                        <div
                          key={day.date}
                          className={`rounded-[22px] border p-4 ${statusPanelClasses[day.status]}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                {day.dayLabel}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-900">
                                {formatDate(day.date)}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusChipClasses[day.status]}`}
                            >
                              {getStatusLabel(day)}
                            </span>
                          </div>

                          <div className="mt-4">
                            <div className="text-2xl font-semibold tracking-tight text-slate-950">
                              {formatMinutesAsClock(day.loggedMinutes)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Target {formatMinutesAsClock(day.targetMinutes)}
                            </div>
                          </div>

                          <div className="mt-4 text-xs leading-5 text-slate-600">
                            {day.status === "partial" || day.status === "empty" ? (
                              <span>
                                Need {formatMinutesAsClock(day.missingMinutes)} more
                              </span>
                            ) : day.status === "over" ? (
                              <span>
                                Over by{" "}
                                {formatMinutesAsClock(
                                  day.loggedMinutes - day.targetMinutes
                                )}
                              </span>
                            ) : day.status === "weekend" ? (
                              <span>Weekend hours are shown separately.</span>
                            ) : day.status === "upcoming" ? (
                              <span>This workday has not happened yet.</span>
                            ) : (
                              <span>Daily target is covered.</span>
                            )}
                          </div>

                          {day.projects.length ? (
                            <div className="mt-4 space-y-2">
                              {day.projects.slice(0, 3).map((project) => (
                                <div
                                  key={`${day.date}-${project.projectId}`}
                                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-xs text-slate-600"
                                >
                                  <span className="truncate">
                                    {project.projectName}
                                  </span>
                                  <span className="shrink-0 font-semibold text-slate-900">
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

              <aside className="space-y-5">
                <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Days that still need hours
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Use this as your follow-up list when you need to backfill
                    time entries to reach the daily 8-hour policy.
                  </p>

                  <div className="mt-4 space-y-3">
                    {totalAttentionDays ? (
                      analytics.attentionDays.slice(0, 12).map((day) => (
                        <div
                          key={`attention-${day.date}`}
                          className="rounded-[20px] border border-amber-200 bg-amber-50/70 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {formatDate(day.date)}
                              </div>
                              <div className="text-xs text-slate-500">
                                Logged {formatMinutesAsClock(day.loggedMinutes)} of{" "}
                                {formatMinutesAsClock(day.targetMinutes)}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-amber-800">
                              Need {formatMinutesAsClock(day.missingMinutes)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                        Every tracked weekday in this range already meets the
                        8-hour target.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Clock3 className="h-4 w-4 text-sky-700" />
                    Coverage snapshot
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
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
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-sm text-slate-500">
            Open Analytics to load your weekly hour summary.
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
    <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{helper}</div>
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
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span>{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  )
}
