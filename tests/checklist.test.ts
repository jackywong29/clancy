import assert from 'assert'
import { test } from './harness'
import { fakeSupabase } from './fake-supabase'
import {
  parseChecklist,
  generateStageTasks,
  blockingTasksFor,
  checklistProgress,
  stageProgressByRecord,
} from '@/lib/checklist'
import { addDays, klToday } from '@/lib/dates'
import type { ChecklistItem, PipelineStage } from '@/types/database'

// Checklists arrive as untrusted JSONB (018/019 deliberately carry no CHECK
// constraints), so parseChecklist is the only thing standing between a
// hand-edited stage row and the task generator.

const stage = (checklist: unknown): Pick<PipelineStage, 'id' | 'checklist'> => ({
  id: 'stage-1',
  checklist: checklist as ChecklistItem[],
})

test('parseChecklist drops items with no usable title', () => {
  const items = parseChecklist([
    { title: 'Photograph the vehicle' },
    { title: '   ' },
    { title: 42 },
    null,
    'not an object',
  ])
  assert.deepStrictEqual(
    items.map((i) => i.title),
    ['Photograph the vehicle']
  )
})

test('parseChecklist trims titles and drops blank optional fields', () => {
  const [item] = parseChecklist([
    { title: '  Send the quote  ', details: '   ', department: '', who: 'x' },
  ])
  assert.strictEqual(item.title, 'Send the quote')
  assert.strictEqual(item.details, undefined)
  assert.strictEqual(item.department, undefined)
})

test('parseChecklist normalises due_in_days to a non-negative whole number', () => {
  const days = parseChecklist([
    { title: 'a', due_in_days: 2.6 },
    { title: 'b', due_in_days: -5 },
    { title: 'c', due_in_days: 'tomorrow' },
    { title: 'd', due_in_days: Number.NaN },
    { title: 'e', due_in_days: 0 },
  ]).map((i) => i.due_in_days)
  assert.deepStrictEqual(days, [3, 0, undefined, undefined, 0])
})

test('parseChecklist treats only a real true as blocking', () => {
  const flags = parseChecklist([
    { title: 'a', blocking: true },
    { title: 'b', blocking: 'true' },
    { title: 'c' },
  ]).map((i) => i.blocking)
  assert.deepStrictEqual(flags, [true, false, false])
})

test('parseChecklist returns empty for a non-array value', () => {
  assert.deepStrictEqual(parseChecklist(null), [])
  assert.deepStrictEqual(parseChecklist({ title: 'a' }), [])
  assert.deepStrictEqual(parseChecklist('[]'), [])
})

test('generateStageTasks creates one task per item, stamped with the stage', async () => {
  const fake = fakeSupabase({ tasks: [] })
  const before = klToday()
  const result = await generateStageTasks({
    supabase: fake.client,
    organizationId: 'org-1',
    clientId: 'rec-1',
    stage: stage([
      { title: 'Photograph the vehicle', due_in_days: 2, department: 'workshop' },
      { title: 'Log parts needed' },
    ]),
    userId: 'user-1',
  })

  assert.strictEqual(result.created, 2)
  assert.strictEqual(result.error, undefined)
  assert.strictEqual(fake.inserted.length, 1)

  const [photo, parts] = fake.inserted[0]
  assert.strictEqual(photo.organization_id, 'org-1')
  assert.strictEqual(photo.client_id, 'rec-1')
  assert.strictEqual(photo.origin_stage_id, 'stage-1')
  assert.strictEqual(photo.status, 'pending')
  assert.strictEqual(photo.created_by, 'user-1')
  assert.strictEqual(photo.department, 'workshop')
  // Due dates are computed in Malaysia time; accept either side of a midnight
  // flip between the test reading the date and the function reading it.
  assert.ok(
    [addDays(before, 2), addDays(klToday(), 2)].includes(photo.due_date as string),
    `unexpected due_date ${String(photo.due_date)}`
  )
  // No due_in_days must mean no due date, not "today".
  assert.strictEqual(parts.due_date, null)
  assert.strictEqual(parts.department, null)
})

test('generateStageTasks is idempotent for a record already holding the tasks', async () => {
  const fake = fakeSupabase({
    tasks: [
      { title: 'Photograph the vehicle', client_id: 'rec-1', origin_stage_id: 'stage-1' },
      { title: 'Log parts needed', client_id: 'rec-1', origin_stage_id: 'stage-1' },
    ],
  })
  const result = await generateStageTasks({
    supabase: fake.client,
    organizationId: 'org-1',
    clientId: 'rec-1',
    stage: stage([{ title: 'Photograph the vehicle' }, { title: 'Log parts needed' }]),
    userId: null,
  })
  assert.strictEqual(result.created, 0)
  assert.deepStrictEqual(fake.inserted, [])
})

test('generateStageTasks backfills only the items the record is missing', async () => {
  // The regression this replaced: an all-or-nothing check meant one existing
  // task made "add this stage's tasks" silently do nothing.
  const fake = fakeSupabase({
    tasks: [
      { title: 'Photograph the vehicle', client_id: 'rec-1', origin_stage_id: 'stage-1' },
    ],
  })
  const result = await generateStageTasks({
    supabase: fake.client,
    organizationId: 'org-1',
    clientId: 'rec-1',
    stage: stage([
      { title: 'Photograph the vehicle' },
      { title: 'Log parts needed' },
      { title: 'Send the quote' },
    ]),
    userId: null,
  })
  assert.strictEqual(result.created, 2)
  assert.deepStrictEqual(
    fake.inserted[0].map((r) => r.title),
    ['Log parts needed', 'Send the quote']
  )
})

test('generateStageTasks scopes its idempotency read to this record and stage', async () => {
  // A same-titled task on another record must not suppress generation.
  const fake = fakeSupabase({
    tasks: [
      { title: 'Send the quote', client_id: 'rec-2', origin_stage_id: 'stage-1' },
      { title: 'Send the quote', client_id: 'rec-1', origin_stage_id: 'stage-9' },
    ],
  })
  const result = await generateStageTasks({
    supabase: fake.client,
    organizationId: 'org-1',
    clientId: 'rec-1',
    stage: stage([{ title: 'Send the quote' }]),
    userId: null,
  })
  assert.strictEqual(result.created, 1)
  assert.deepStrictEqual(fake.filters.tasks, [
    { op: 'eq', column: 'client_id', value: 'rec-1' },
    { op: 'eq', column: 'origin_stage_id', value: 'stage-1' },
  ])
})

test('generateStageTasks does nothing for a stage with no checklist', async () => {
  const fake = fakeSupabase({ tasks: [] })
  const result = await generateStageTasks({
    supabase: fake.client,
    organizationId: 'org-1',
    clientId: 'rec-1',
    stage: stage([]),
    userId: null,
  })
  assert.deepStrictEqual(result, { created: 0 })
  assert.deepStrictEqual(fake.inserted, [])
  assert.strictEqual(fake.filters.tasks, undefined)
})

test('generateStageTasks surfaces read and insert failures instead of a silent 0', async () => {
  const readFail = await generateStageTasks({
    supabase: fakeSupabase({ readError: 'permission denied' }).client,
    organizationId: 'org-1',
    clientId: 'rec-1',
    stage: stage([{ title: 'Send the quote' }]),
    userId: null,
  })
  assert.strictEqual(readFail.created, 0)
  assert.strictEqual(readFail.error, 'permission denied')

  const insertFail = await generateStageTasks({
    supabase: fakeSupabase({ tasks: [], insertError: 'violates row-level security' })
      .client,
    organizationId: 'org-1',
    clientId: 'rec-1',
    stage: stage([{ title: 'Send the quote' }]),
    userId: null,
  })
  assert.strictEqual(insertFail.created, 0)
  assert.strictEqual(insertFail.error, 'violates row-level security')
})

test('blockingTasksFor reports only outstanding blocking items', async () => {
  const fake = fakeSupabase({
    tasks: [
      { title: 'Send the quote', status: 'pending', client_id: 'rec-1', origin_stage_id: 'stage-1' },
      { title: 'Photograph the vehicle', status: 'pending', client_id: 'rec-1', origin_stage_id: 'stage-1' },
      { title: 'Get approval', status: 'done', client_id: 'rec-1', origin_stage_id: 'stage-1' },
      // Another record's outstanding blocker must not hold this one back.
      { title: 'Send the quote', status: 'pending', client_id: 'rec-2', origin_stage_id: 'stage-1' },
    ],
  })
  const outstanding = await blockingTasksFor(fake.client, 'rec-1', {
    id: 'stage-1',
    checklist: parseChecklist([
      { title: 'Send the quote', blocking: true },
      { title: 'Get approval', blocking: true },
      { title: 'Photograph the vehicle' },
    ]),
  })
  // 'Get approval' is done, 'Photograph the vehicle' is not blocking.
  assert.deepStrictEqual(outstanding, ['Send the quote'])
  // Done tasks are excluded in the query, not just in JS.
  assert.ok(
    fake.filters.tasks.some(
      (f) => f.op === 'neq' && f.column === 'status' && f.value === 'done'
    )
  )
})

test('blockingTasksFor never queries when the stage blocks nothing', async () => {
  const fake = fakeSupabase({ tasks: [{ title: 'a', status: 'pending' }] })
  const outstanding = await blockingTasksFor(fake.client, 'rec-1', {
    id: 'stage-1',
    checklist: parseChecklist([{ title: 'a' }]),
  })
  assert.deepStrictEqual(outstanding, [])
  assert.strictEqual(fake.filters.tasks, undefined)
})

test('checklistProgress counts done against total', () => {
  assert.deepStrictEqual(
    checklistProgress([{ status: 'done' }, { status: 'pending' }, { status: 'in_progress' }]),
    { done: 1, total: 3 }
  )
  assert.deepStrictEqual(checklistProgress([]), { done: 0, total: 0 })
})

test('stageProgressByRecord ignores tasks left behind in earlier stages', () => {
  const progress = stageProgressByRecord(
    [
      { id: 'rec-1', stage_id: 'stage-2' },
      { id: 'rec-2', stage_id: 'stage-1' },
    ],
    [
      { client_id: 'rec-1', origin_stage_id: 'stage-2', status: 'done' },
      { client_id: 'rec-1', origin_stage_id: 'stage-2', status: 'pending' },
      // rec-1 has moved on from stage-1: this must not inflate the pill.
      { client_id: 'rec-1', origin_stage_id: 'stage-1', status: 'pending' },
      { client_id: 'rec-2', origin_stage_id: 'stage-1', status: 'done' },
      // Standalone task (not from a checklist) and an orphan row.
      { client_id: 'rec-2', origin_stage_id: null, status: 'pending' },
      { client_id: null, origin_stage_id: 'stage-1', status: 'pending' },
    ]
  )
  assert.deepStrictEqual(progress, {
    'rec-1': { done: 1, total: 2 },
    'rec-2': { done: 1, total: 1 },
  })
})

test('stageProgressByRecord returns nothing when there are no tasks', () => {
  assert.deepStrictEqual(
    stageProgressByRecord([{ id: 'rec-1', stage_id: 'stage-1' }], null),
    {}
  )
  assert.deepStrictEqual(stageProgressByRecord([], []), {})
})
