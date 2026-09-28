// The Overview dashboard, as one pure function.
//
// The page fetches rows; this turns them into every number on screen. Keeping
// it free of Supabase, the clock and the request means each figure can be
// unit-tested with plain objects (tests/dashboard.test.ts) — a dashboard that
// quietly miscounts is worse than none, because people act on it.
//
// Aggregation happens here rather than in SQL because a service business has
// hundreds of records, not millions. Past a few thousand per workspace, move
// the counting into a database view.

export const STUCK_AMBER_DAYS = 7
export const STUCK_RED_DAYS = 14
const WAITING_LIMIT = 8
const DAY_MS = 24 * 60 * 60 * 1000

export interface DashboardStage {
  id: string
  name: string
  position: number
}

export interface DashboardRecord {
  id: string
  company_name: string
  stage_id: string | null
  stage_entered_at: string | null
  created_at: string
  updated_at: string
  source: string | null
}

export interface DashboardTask {
  status: string
  due_date: string | null
  department: string | null
  completed_at: string | null
}

export interface DashboardTransition {
  client_id: string
  to_stage_id: string | null
  at: string
}

export interface DashboardInput {
  stages: DashboardStage[]
  records: DashboardRecord[]
  tasks: DashboardTask[]
  /** Stage moves since the start of this month. */
  transitions: DashboardTransition[]
  /** The earliest stage move ever recorded, or null if none yet. */
  firstTransitionAt: string | null
  finishStageId?: string
  departments: { key: string; name: string }[]
  /** YYYY-MM-DD, Malaysia time. */
  today: string
  /** The instant this Malaysian month began. */
  monthStart: Date
  now: Date
  /** Converts a UTC timestamp to its Malaysian calendar date. */
  toKlDate: (iso: string) => string
  viewer: { isAdmin: boolean; department: string | null }
}

export type WaitLevel = 'ok' | 'amber' | 'red'

export interface DashboardData {
  finishStage: { id: string; name: string } | null
  /** True when no finish line was chosen and the last stage stands in. */
  finishIsDefault: boolean
  open: number
  finishedThisMonth: number
  /** Set while stage history covers less than this whole month. */
  countingSince: string | null
  overdue: number
  dueToday: number
  doneLast7Days: number
  pipeline: {
    id: string
    name: string
    count: number
    isFinish: boolean
    pastFinish: boolean
  }[]
  waiting: {
    id: string
    name: string
    stageName: string
    days: number
    level: WaitLevel
  }[]
  teamLoad: { key: string | null; name: string; open: number; overdue: number }[]
  newThisMonth: { total: number; website: number; manual: number }
}

export function waitLevel(days: number): WaitLevel {
  if (days >= STUCK_RED_DAYS) return 'red'
  if (days >= STUCK_AMBER_DAYS) return 'amber'
  return 'ok'
}

export function buildDashboard(input: DashboardInput): DashboardData {
  const stages = [...input.stages].sort((a, b) => a.position - b.position)
  const byId = new Map(stages.map((s) => [s.id, s]))

  // The finish line: the chosen stage if it still exists, else the last one.
  const chosen = input.finishStageId ? byId.get(input.finishStageId) : undefined
  const finish = chosen ?? stages[stages.length - 1] ?? null
  const finishIsDefault = !chosen

  // At or past the finish line = finished. A record with no stage, or in a
  // stage that has since been deleted, still counts as open work.
  const isFinished = (stageId: string | null): boolean => {
    if (!finish || !stageId) return false
    const s = byId.get(stageId)
    return Boolean(s && s.position >= finish.position)
  }

  const openRecords = input.records.filter((r) => !isFinished(r.stage_id))

  // Distinct records that reached the finish line this month — a record that
  // crossed it twice (moved back, then forward again) counts once.
  const finishedIds = new Set(
    finish
      ? input.transitions
          .filter(
            (t) =>
              t.to_stage_id === finish.id &&
              new Date(t.at).getTime() >= input.monthStart.getTime()
          )
          .map((t) => t.client_id)
      : []
  )

  // History only exists from the day migration 020 ran. Until it covers the
  // whole month, say so rather than present a partial count as the truth.
  const countingSince =
    input.firstTransitionAt === null
      ? input.today
      : new Date(input.firstTransitionAt).getTime() > input.monthStart.getTime()
        ? input.toKlDate(input.firstTransitionAt)
        : null

  // Task tiles follow the same scoping as /tasks: admins see everything,
  // everyone else sees their own department plus shared (no-department) work.
  const visibleTasks = input.tasks.filter(
    (t) =>
      input.viewer.isAdmin ||
      t.department === null ||
      t.department === input.viewer.department
  )
  const openTasks = visibleTasks.filter((t) => t.status !== 'done')
  const isOverdue = (t: DashboardTask) =>
    t.due_date !== null && t.due_date < input.today
  const weekAgo = input.now.getTime() - 7 * DAY_MS

  const pipeline = stages.map((s) => ({
    id: s.id,
    name: s.name,
    count: input.records.filter((r) => r.stage_id === s.id).length,
    isFinish: finish?.id === s.id,
    pastFinish: finish ? s.position > finish.position : false,
  }))

  // Longest waiting: open records IN a stage, by time since they entered it.
  // stage_entered_at is exact from migration 020 onward; older rows were
  // backfilled from updated_at, and the fallbacks cover a row it missed.
  const waiting = openRecords
    .filter((r) => r.stage_id !== null && byId.has(r.stage_id))
    .map((r) => {
      const since = r.stage_entered_at ?? r.updated_at ?? r.created_at
      const days = Math.max(
        0,
        Math.floor((input.now.getTime() - new Date(since).getTime()) / DAY_MS)
      )
      return {
        id: r.id,
        name: r.company_name,
        stageName: byId.get(r.stage_id as string)?.name ?? '',
        days,
        level: waitLevel(days),
      }
    })
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name))
    .slice(0, WAITING_LIMIT)

  const deptName = new Map(input.departments.map((d) => [d.key, d.name]))
  const load = new Map<string | null, { open: number; overdue: number }>()
  for (const t of openTasks) {
    const entry = load.get(t.department) ?? { open: 0, overdue: 0 }
    entry.open += 1
    if (isOverdue(t)) entry.overdue += 1
    load.set(t.department, entry)
  }
  const teamLoad = [...load.entries()]
    .map(([key, v]) => ({
      key,
      // A task can point at a department that was since renamed or removed.
      name: key === null ? 'Shared' : (deptName.get(key) ?? key),
      ...v,
    }))
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name))

  const createdThisMonth = input.records.filter(
    (r) => new Date(r.created_at).getTime() >= input.monthStart.getTime()
  )
  const website = createdThisMonth.filter((r) => r.source === 'website form').length

  return {
    finishStage: finish ? { id: finish.id, name: finish.name } : null,
    finishIsDefault,
    open: openRecords.length,
    finishedThisMonth: finishedIds.size,
    countingSince,
    overdue: openTasks.filter(isOverdue).length,
    dueToday: openTasks.filter((t) => t.due_date === input.today).length,
    doneLast7Days: visibleTasks.filter(
      (t) =>
        t.status === 'done' &&
        t.completed_at !== null &&
        new Date(t.completed_at).getTime() >= weekAgo
    ).length,
    pipeline,
    waiting,
    teamLoad,
    newThisMonth: {
      total: createdThisMonth.length,
      website,
      manual: createdThisMonth.length - website,
    },
  }
}
