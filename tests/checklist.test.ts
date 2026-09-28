import assert from 'assert'
import { test } from './harness'
import {
  parseChecklist,
  checklistProgress,
  stageProgressByRecord,
} from '@/lib/checklist'

// Checklists arrive as untrusted JSONB (018/019 deliberately carry no CHECK
// constraints), so parseChecklist is the only thing standing between a
// hand-edited stage row and the editor.
//
// Task generation and the blocking rule moved into the database in migration
// 020 (generate_stage_tasks + the clients_stage_guard trigger). Their tests
// moved with them: supabase/020_verify.sql exercises idempotency, pulling in
// newly added items, blocker selection, backward moves and due dates against
// the real schema.

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
