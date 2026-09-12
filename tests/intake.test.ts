import assert from 'assert'
import { test } from './harness'
import {
  parseWorkflowSteps,
  fieldFilled,
  buildWorkflowBrief,
  INTAKE_SECTIONS,
  type IntakeField,
} from '@/lib/intake'
import type { Client, CrmConfig } from '@/types/database'

// The workflow intake field changed type from `steps` (string[]) to `workflow`
// (objects with per-step detail). Intakes captured before that still hold the
// old shape in intakes.data, so parseWorkflowSteps has to read both — SGCKL's
// intake is one of them.

const workflowField: IntakeField = { key: 'pipeline_steps', label: '', type: 'workflow' }
const client = { company_name: 'Ah Meng Workshop' } as Client
const config = {} as CrmConfig

test('parseWorkflowSteps reads the legacy string[] shape', () => {
  const steps = parseWorkflowSteps('["Inquiry","Diagnosis","  ","Invoiced"]')
  assert.deepStrictEqual(steps, [
    { name: 'Inquiry' },
    { name: 'Diagnosis' },
    { name: 'Invoiced' },
  ])
})

test('parseWorkflowSteps reads the detailed shape and trims blanks to undefined', () => {
  const [step] = parseWorkflowSteps(
    JSON.stringify([
      {
        name: '  Diagnosis  ',
        tasks: 'Photograph the car\nList parts',
        who: 'Workshop',
        duration: '  ',
        blocker: '',
        automatic: 'Text the customer the quote',
      },
    ])
  )
  assert.deepStrictEqual(step, {
    name: 'Diagnosis',
    tasks: 'Photograph the car\nList parts',
    who: 'Workshop',
    duration: undefined,
    blocker: undefined,
    automatic: 'Text the customer the quote',
  })
})

test('parseWorkflowSteps drops nameless rows and tolerates mixed shapes', () => {
  const steps = parseWorkflowSteps(
    JSON.stringify(['Inquiry', { name: '  ' }, { tasks: 'orphan detail' }, { name: 'Done' }])
  )
  assert.deepStrictEqual(
    steps.map((s) => s.name),
    ['Inquiry', 'Done']
  )
})

test('parseWorkflowSteps falls back to a single step for non-JSON text', () => {
  // A hand-typed answer must not silently vanish from the brief.
  assert.deepStrictEqual(parseWorkflowSteps('Inquiry then quote then job'), [
    { name: 'Inquiry then quote then job' },
  ])
  assert.deepStrictEqual(parseWorkflowSteps(undefined), [])
  assert.deepStrictEqual(parseWorkflowSteps('   '), [])
  assert.deepStrictEqual(parseWorkflowSteps('{"name":"not an array"}'), [])
})

test('fieldFilled treats an empty or nameless workflow as unanswered', () => {
  assert.strictEqual(fieldFilled(workflowField, '[]'), false)
  assert.strictEqual(fieldFilled(workflowField, '[{"name":"  "}]'), false)
  assert.strictEqual(fieldFilled(workflowField, undefined), false)
  assert.strictEqual(fieldFilled(workflowField, '[{"name":"Inquiry"}]'), true)
})

test('the workflow step field is a blocking, client-facing intake question', () => {
  // Progress on the intake tab and the client-facing /i/<token> form both key
  // off these flags; the workflow brief is unbuildable without this answer.
  const section = INTAKE_SECTIONS.find((s) => s.key === 'workflow')
  const field = section?.fields.find((f) => f.key === 'pipeline_steps')
  assert.ok(field)
  assert.strictEqual(field.type, 'workflow')
  assert.strictEqual(field.blocking, true)
  assert.strictEqual(field.clientFacing, true)
})

test('buildWorkflowBrief lists every captured step in order', () => {
  const brief = buildWorkflowBrief(
    client,
    {
      'workflow.pipeline_steps': JSON.stringify([
        { name: 'Inquiry' },
        { name: 'Diagnosis', who: 'Workshop' },
        { name: 'Invoiced' },
      ]),
    },
    config
  )
  const positions = ['Inquiry', 'Diagnosis', 'Invoiced'].map((n) => brief.indexOf(n))
  assert.ok(
    positions.every((p) => p > -1),
    'every step name should appear in the brief'
  )
  assert.deepStrictEqual(
    positions.slice().sort((a, b) => a - b),
    positions,
    'steps should appear in intake order'
  )
})

test('buildWorkflowBrief carries the automation wishlist and only that', () => {
  const brief = buildWorkflowBrief(
    client,
    {
      'workflow.pipeline_steps': JSON.stringify([
        { name: 'Diagnosis', automatic: 'Text the quote' },
        { name: 'Collected' },
      ]),
      'workflow.followups': 'Call a week after a service',
    },
    config
  )
  const wishlist = brief.slice(brief.indexOf('## Automation wishlist'))
  assert.ok(wishlist.includes('Text the quote'))
  assert.ok(wishlist.includes('Call a week after a service'))
  // A step with nothing wished for must not appear as a wish.
  assert.ok(!wishlist.includes('Collected'))
})

test('buildWorkflowBrief admits a missing process instead of inventing stages', () => {
  const brief = buildWorkflowBrief(client, {}, config)
  assert.ok(brief.includes(client.company_name))
  assert.ok(!brief.includes('### 1.'), 'no numbered stages should be fabricated')
})
