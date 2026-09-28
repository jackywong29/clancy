import assert from 'assert'
import { test } from './harness'
import {
  buildDashboard,
  waitLevel,
  type DashboardInput,
  type DashboardRecord,
  type DashboardTask,
} from '@/lib/dashboard'
import { klDateOf } from '@/lib/dates'

// A fixed clock: Saturday 26 Sep 2026, noon in Kuala Lumpur.
const NOW = new Date('2026-09-26T04:00:00Z')
const MONTH_START = new Date('2026-09-01T00:00:00+08:00')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString()

const STAGES = [
  { id: 'lead', name: 'Lead', position: 1 },
  { id: 'work', name: 'In progress', position: 2 },
  { id: 'active', name: 'Active', position: 3 },
  { id: 'renew', name: 'Renewal due', position: 4 },
]

let seq = 0
function rec(stage_id: string | null, over: Partial<DashboardRecord> = {}): DashboardRecord {
  seq += 1
  return {
    id: `r${seq}`,
    company_name: `Record ${seq}`,
    stage_id,
    stage_entered_at: daysAgo(1),
    created_at: daysAgo(60),
    updated_at: daysAgo(1),
    source: null,
    ...over,
  }
}

function task(over: Partial<DashboardTask> = {}): DashboardTask {
  return { status: 'pending', due_date: null, department: null, completed_at: null, ...over }
}

function input(over: Partial<DashboardInput> = {}): DashboardInput {
  return {
    stages: STAGES,
    records: [],
    tasks: [],
    transitions: [],
    firstTransitionAt: '2026-08-01T00:00:00Z',
    departments: [
      { key: 'workshop', name: 'Workshop' },
      { key: 'front', name: 'Front desk' },
    ],
    today: '2026-09-26',
    monthStart: MONTH_START,
    now: NOW,
    toKlDate: klDateOf,
    viewer: { isAdmin: true, department: null },
    ...over,
  }
}

test('finish line defaults to the last stage when none is chosen', () => {
  const d = buildDashboard(input())
  assert.strictEqual(d.finishStage?.id, 'renew')
  assert.strictEqual(d.finishIsDefault, true)
})

test('a chosen finish line wins, and a deleted one falls back to the last stage', () => {
  assert.strictEqual(buildDashboard(input({ finishStageId: 'active' })).finishStage?.id, 'active')
  const gone = buildDashboard(input({ finishStageId: 'deleted-stage' }))
  assert.strictEqual(gone.finishStage?.id, 'renew')
  assert.strictEqual(gone.finishIsDefault, true)
})

test('records at OR past the finish line are finished (Active, then Renewal due)', () => {
  const d = buildDashboard(
    input({
      finishStageId: 'active',
      records: [rec('lead'), rec('work'), rec('active'), rec('renew')],
    })
  )
  // Clancy's own pipeline: Active is success and Renewal due comes after it —
  // neither is open work, and neither should ever show as stuck.
  assert.strictEqual(d.open, 2)
  assert.deepStrictEqual(
    d.pipeline.map((p) => [p.id, p.isFinish, p.pastFinish]),
    [
      ['lead', false, false],
      ['work', false, false],
      ['active', true, false],
      ['renew', false, true],
    ]
  )
})

test('a record with no stage is open work but never listed as waiting in a stage', () => {
  const d = buildDashboard(input({ records: [rec(null)] }))
  assert.strictEqual(d.open, 1)
  assert.strictEqual(d.waiting.length, 0)
})

test('finished this month counts distinct records crossing the line this month', () => {
  const d = buildDashboard(
    input({
      finishStageId: 'active',
      transitions: [
        { client_id: 'a', to_stage_id: 'active', at: daysAgo(3) },
        // Same record crossed twice (sent back, then forward again): once.
        { client_id: 'a', to_stage_id: 'active', at: daysAgo(1) },
        { client_id: 'b', to_stage_id: 'active', at: daysAgo(2) },
        // Moves into other stages don't count.
        { client_id: 'c', to_stage_id: 'work', at: daysAgo(2) },
        // Last month doesn't count.
        { client_id: 'd', to_stage_id: 'active', at: '2026-08-30T00:00:00Z' },
      ],
    })
  )
  assert.strictEqual(d.finishedThisMonth, 2)
})

test('the month starts at midnight in Malaysia, not midnight UTC', () => {
  // 20:00 UTC on 31 Aug is 04:00 on 1 Sep in Kuala Lumpur — this month.
  const d = buildDashboard(
    input({
      finishStageId: 'active',
      records: [
        rec('lead', { created_at: '2026-08-31T20:00:00Z' }),
        // 15:00 UTC on 31 Aug is 23:00 on 31 Aug in KL — last month.
        rec('lead', { created_at: '2026-08-31T15:00:00Z' }),
      ],
      transitions: [{ client_id: 'x', to_stage_id: 'active', at: '2026-08-31T20:00:00Z' }],
    })
  )
  assert.strictEqual(d.newThisMonth.total, 1)
  assert.strictEqual(d.finishedThisMonth, 1)
})

test('counting-since is shown only while history is younger than the month', () => {
  assert.strictEqual(buildDashboard(input({ firstTransitionAt: null })).countingSince, '2026-09-26')
  assert.strictEqual(
    buildDashboard(input({ firstTransitionAt: '2026-09-25T20:00:00Z' })).countingSince,
    '2026-09-26' // 20:00 UTC on the 25th is the 26th in KL
  )
  assert.strictEqual(
    buildDashboard(input({ firstTransitionAt: '2026-08-15T00:00:00Z' })).countingSince,
    null
  )
})

test('task tiles are scoped like /tasks: own department plus shared', () => {
  const tasks = [
    task({ due_date: '2026-09-20', department: 'workshop' }),
    task({ due_date: '2026-09-20', department: 'front' }),
    task({ due_date: '2026-09-20', department: null }),
  ]
  const staff = buildDashboard(input({ tasks, viewer: { isAdmin: false, department: 'workshop' } }))
  assert.strictEqual(staff.overdue, 2) // workshop + shared, not front desk
  const admin = buildDashboard(input({ tasks }))
  assert.strictEqual(admin.overdue, 3)
})

test('overdue, due today and done are counted separately', () => {
  const d = buildDashboard(
    input({
      tasks: [
        task({ due_date: '2026-09-25' }), // overdue
        task({ due_date: '2026-09-26' }), // due today
        task({ due_date: '2026-09-27' }), // future
        task({ due_date: null }), // undated
        task({ due_date: '2026-09-01', status: 'done' }), // done: never overdue
      ],
    })
  )
  assert.strictEqual(d.overdue, 1)
  assert.strictEqual(d.dueToday, 1)
})

test('done-in-7-days reads completed_at, not status alone', () => {
  const d = buildDashboard(
    input({
      tasks: [
        task({ status: 'done', completed_at: daysAgo(2) }),
        task({ status: 'done', completed_at: daysAgo(10) }), // too old
        task({ status: 'done', completed_at: null }), // no timestamp: unknown
        task({ status: 'pending', completed_at: null }),
      ],
    })
  )
  assert.strictEqual(d.doneLast7Days, 1)
})

test('longest waiting sorts by days in stage, caps at 8, and skips finished records', () => {
  const records = [
    ...Array.from({ length: 10 }, (_, i) => rec('work', { stage_entered_at: daysAgo(i) })),
    rec('active', { stage_entered_at: daysAgo(99) }), // finished: never "stuck"
  ]
  const d = buildDashboard(input({ finishStageId: 'active', records }))
  assert.strictEqual(d.waiting.length, 8)
  assert.deepStrictEqual(
    d.waiting.map((w) => w.days),
    [9, 8, 7, 6, 5, 4, 3, 2]
  )
  assert.ok(d.waiting.every((w) => w.stageName === 'In progress'))
})

test('waiting uses the stage clock, not the last edit', () => {
  // Edited yesterday, but sitting in this stage for 20 days: it's stuck.
  const d = buildDashboard(
    input({ records: [rec('work', { stage_entered_at: daysAgo(20), updated_at: daysAgo(1) })] })
  )
  assert.strictEqual(d.waiting[0].days, 20)
  assert.strictEqual(d.waiting[0].level, 'red')
})

test('stuck colours: amber from 7 days, red from 14', () => {
  assert.strictEqual(waitLevel(6), 'ok')
  assert.strictEqual(waitLevel(7), 'amber')
  assert.strictEqual(waitLevel(13), 'amber')
  assert.strictEqual(waitLevel(14), 'red')
})

test('team load groups by department, names shared and removed ones, worst first', () => {
  const d = buildDashboard(
    input({
      tasks: [
        task({ department: 'workshop', due_date: '2026-09-20' }),
        task({ department: 'workshop', due_date: '2026-09-20' }),
        task({ department: 'front' }),
        task({ department: null, due_date: '2026-09-20' }),
        task({ department: 'old-team' }),
        task({ department: 'front', status: 'done' }), // done: not load
      ],
    })
  )
  assert.deepStrictEqual(
    d.teamLoad.map((t) => [t.name, t.open, t.overdue]),
    [
      ['Workshop', 2, 2],
      ['Shared', 1, 1],
      ['Front desk', 1, 0],
      ['old-team', 1, 0],
    ]
  )
})

test('new this month splits website signups from records added by hand', () => {
  const d = buildDashboard(
    input({
      records: [
        rec('lead', { created_at: daysAgo(3), source: 'website form' }),
        rec('lead', { created_at: daysAgo(3), source: null }),
        rec('lead', { created_at: daysAgo(3), source: 'referral' }),
        rec('lead', { created_at: daysAgo(40), source: 'website form' }), // last month
      ],
    })
  )
  assert.deepStrictEqual(d.newThisMonth, { total: 3, website: 1, manual: 2 })
})

test('an empty workspace produces zeros, not errors', () => {
  const d = buildDashboard(input({ stages: [], firstTransitionAt: null }))
  assert.strictEqual(d.finishStage, null)
  assert.strictEqual(d.open, 0)
  assert.strictEqual(d.finishedThisMonth, 0)
  assert.deepStrictEqual(d.pipeline, [])
})
