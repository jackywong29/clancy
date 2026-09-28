import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMembership, hasRole } from '@/lib/permissions'
import { Header } from '@/components/Header'
import { recordLabel } from '@/lib/crm'
import { klDateOf, klMonthStart, klToday } from '@/lib/dates'
import {
  buildDashboard,
  STUCK_AMBER_DAYS,
  STUCK_RED_DAYS,
  type WaitLevel,
} from '@/lib/dashboard'

// The Overview: the state of the business on one screen. Home for client
// workspaces (see app/home). Every number comes from lib/dashboard.ts, which
// is pure and unit-tested — this page only fetches rows and lays them out.

const LEVEL_STYLE: Record<WaitLevel, string> = {
  ok: 'bg-ash/40 text-ivory/70',
  amber: 'bg-amber-950/40 text-amber-300',
  red: 'bg-red-950/50 text-red-300',
}

function shortDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
  })
}

export default async function OverviewPage() {
  const supabase = await createClient()
  const m = await getMembership()
  const isClancy = m.orgSlug === 'clancy'
  const isAdmin = hasRole(m, 'admin')
  const showTasks = isClancy || m.crmConfig.modules?.tasks === true
  const monthStart = klMonthStart()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Five independent reads, in parallel. Each is scoped to this workspace by
  // RLS. Tasks are limited to open work plus the last week's completions, so
  // the query stays bounded as a workspace's history grows.
  const [stagesRes, recordsRes, tasksRes, movesRes, firstMoveRes] = await Promise.all([
    supabase.from('pipeline_stages').select('id, name, position').order('position'),
    supabase
      .from('clients')
      .select('id, company_name, stage_id, stage_entered_at, created_at, updated_at, source'),
    supabase
      .from('tasks')
      .select('status, due_date, department, completed_at')
      // Quoted: PostgREST treats . and : as reserved inside or(), and an ISO
      // timestamp contains both.
      .or(`status.neq.done,completed_at.gte."${weekAgo}"`),
    supabase
      .from('stage_transitions')
      .select('client_id, to_stage_id, at')
      .gte('at', monthStart.toISOString()),
    supabase
      .from('stage_transitions')
      .select('at')
      .order('at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const failed = [stagesRes, recordsRes, tasksRes, movesRes, firstMoveRes].find((r) => r.error)
  if (failed?.error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <h1 className="mb-4 text-2xl font-medium">Overview</h1>
          <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            The Overview couldn&apos;t load its numbers: {failed.error.message}
            {isAdmin && ' — if this mentions stage_entered_at or stage_transitions, migration 020 hasn’t been run yet.'}
          </p>
        </main>
      </div>
    )
  }

  const today = klToday()
  const d = buildDashboard({
    stages: stagesRes.data ?? [],
    records: recordsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    transitions: movesRes.data ?? [],
    firstTransitionAt: firstMoveRes.data?.at ?? null,
    finishStageId: m.crmConfig.finish_stage_id,
    departments: m.crmConfig.departments ?? [],
    today,
    monthStart,
    now,
    toKlDate: klDateOf,
    viewer: { isAdmin, department: m.department },
  })

  const plural = isClancy ? 'Clients' : recordLabel(m.crmConfig, true)
  const recordHref = (id: string) => (isClancy ? `/clients/${id}` : `/records/${id}`)
  const maxCount = Math.max(1, ...d.pipeline.map((p) => p.count))
  const tile = 'min-w-0 rounded-xl border border-ash/60 bg-carbon p-4'

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-medium">Overview</h1>
          <p className="text-sm text-ivory/60">
            {new Date().toLocaleDateString('en-MY', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'Asia/Kuala_Lumpur',
            })}
          </p>
        </div>

        {d.finishIsDefault && d.finishStage && isAdmin && (
          <p className="mb-4 rounded-lg bg-ash/30 px-3 py-2 text-sm text-ivory/70">
            Counting <strong className="text-ivory">{d.finishStage.name}</strong>{' '}
            as the finish line because it&apos;s your last stage.{' '}
            <Link href="/workflow" className="text-violet hover:underline">
              Choose yours on Workflow
            </Link>{' '}
            if &ldquo;done&rdquo; comes earlier.
          </p>
        )}

        <div className={`mb-6 grid grid-cols-2 gap-3 ${showTasks ? 'lg:grid-cols-4' : ''}`}>
          <div className={tile}>
            <p className="text-xs text-ivory/60">Open {plural.toLowerCase()}</p>
            <p className="mt-1 text-2xl font-medium">{d.open}</p>
            <p className="mt-1 truncate text-xs text-ivory/40">
              {d.finishStage ? `not yet at ${d.finishStage.name}` : 'no stages yet'}
            </p>
          </div>
          <div className={tile}>
            <p className="text-xs text-ivory/60">Finished this month</p>
            <p className="mt-1 text-2xl font-medium">{d.finishedThisMonth}</p>
            <p className="mt-1 truncate text-xs text-ivory/40">
              {d.countingSince
                ? `counting since ${shortDate(d.countingSince)}`
                : d.finishStage
                  ? `reached ${d.finishStage.name}`
                  : '—'}
            </p>
          </div>
          {showTasks && (
            <>
              <Link href="/tasks" className={`${tile} hover:border-violet`}>
                <p className="text-xs text-ivory/60">Overdue tasks</p>
                <p className={`mt-1 text-2xl font-medium ${d.overdue > 0 ? 'text-red-400' : ''}`}>
                  {d.overdue}
                </p>
                <p className="mt-1 truncate text-xs text-ivory/40">
                  {d.doneLast7Days} done in the last 7 days
                </p>
              </Link>
              <Link href="/tasks" className={`${tile} hover:border-violet`}>
                <p className="text-xs text-ivory/60">Due today</p>
                <p className="mt-1 text-2xl font-medium">{d.dueToday}</p>
                <p className="mt-1 truncate text-xs text-ivory/40">
                  {isAdmin || !m.department ? 'across the team' : 'yours and shared'}
                </p>
              </Link>
            </>
          )}
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-ash/60 bg-carbon p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Where work is</h2>
              <Link href="/pipeline" className="text-xs text-ivory/50 hover:text-violet">
                Open board →
              </Link>
            </div>
            {d.pipeline.length === 0 ? (
              <p className="text-sm text-ivory/50">No stages yet.</p>
            ) : (
              <div className="space-y-2.5">
                {d.pipeline.map((p) => (
                  <div key={p.id} className={p.pastFinish ? 'opacity-50' : ''}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-ivory/80">
                        {p.name}
                        {p.isFinish && (
                          <span className="ml-2 rounded bg-violet/15 px-1.5 py-0.5 text-violet">
                            finish line
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-ivory/60">{p.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-ash/40">
                      <div
                        className={`h-2 rounded-full ${p.isFinish || p.pastFinish ? 'bg-violet' : 'bg-violet/60'}`}
                        style={{ width: `${(p.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-ash/60 bg-carbon p-4">
            <div className="mb-3">
              <h2 className="text-sm font-medium">Longest waiting</h2>
              <p className="text-xs text-ivory/50">
                Open {plural.toLowerCase()} by days in their current stage · amber from{' '}
                {STUCK_AMBER_DAYS}, red from {STUCK_RED_DAYS}
              </p>
            </div>
            {d.waiting.length === 0 ? (
              <p className="text-sm text-ivory/50">Nothing open right now.</p>
            ) : (
              <ul className="divide-y divide-ash/40">
                {d.waiting.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={recordHref(w.id)}
                      className="flex items-center gap-3 py-2 hover:text-violet"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{w.name}</span>
                        <span className="block truncate text-xs text-ivory/50">{w.stageName}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs ${LEVEL_STYLE[w.level]}`}
                      >
                        {w.days === 0 ? 'today' : `${w.days}d`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {showTasks && (
            <section className="rounded-xl border border-ash/60 bg-carbon p-4">
              <h2 className="mb-3 text-sm font-medium">Team load</h2>
              {d.teamLoad.length === 0 ? (
                <p className="text-sm text-ivory/50">No open tasks.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ivory/50">
                      <th className="pb-2 font-normal">Department</th>
                      <th className="pb-2 text-right font-normal">Open</th>
                      <th className="pb-2 text-right font-normal">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ash/40">
                    {d.teamLoad.map((t) => (
                      <tr key={t.key ?? 'shared'}>
                        <td className="max-w-0 truncate py-2 pr-2">{t.name}</td>
                        <td className="py-2 text-right text-ivory/70">{t.open}</td>
                        <td
                          className={`py-2 text-right ${t.overdue > 0 ? 'text-red-400' : 'text-ivory/40'}`}
                        >
                          {t.overdue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          <section className="rounded-xl border border-ash/60 bg-carbon p-4">
            <h2 className="mb-3 text-sm font-medium">New this month</h2>
            <p className="text-2xl font-medium">{d.newThisMonth.total}</p>
            <p className="mt-1 text-xs text-ivory/60">
              {d.newThisMonth.website} from the website form · {d.newThisMonth.manual} added by
              hand
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
