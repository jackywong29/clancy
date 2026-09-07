import type { SupabaseClient } from '@supabase/supabase-js'
import type { Client, CrmConfig } from '@/types/database'

// The client-intake checklist as data (see client-intake-checklist.md).
// Changing sections/fields here never needs a DB migration — answers live
// in intakes.data as JSON keyed "<section>.<field>". Structured field types
// (services, steps, files) store JSON strings under the same keys.

export type IntakeFieldType =
  | 'text'
  | 'long'
  | 'services'
  | 'steps'
  | 'workflow'
  | 'files'

export interface IntakeField {
  key: string
  label: string
  type?: IntakeFieldType
  blocking?: boolean
  hint?: string
  clientFacing?: boolean
}

export interface IntakeSection {
  key: string
  title: string
  fields: IntakeField[]
}

export type IntakeData = Record<string, string>

export interface ServiceRow {
  name: string
  price: string
  duration: string
  bookable: boolean
}

export interface UploadedFile {
  path: string
  name: string
}

// One step of the client's real process, with the detail needed to build it.
// Each field maps onto something concrete: `tasks` become the stage checklist,
// `who` the department, `duration` the due-in-days, `blocker` the blocking
// flag, and `automatic` is the wishlist that tells us which curated
// automations to build first.
export interface WorkflowStep {
  name: string
  tasks?: string
  who?: string
  duration?: string
  blocker?: string
  automatic?: string
}

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    key: 'basics',
    title: 'Business basics',
    fields: [
      { key: 'registered_name', label: 'Registered + trading name', blocking: true , clientFacing: true },
      { key: 'ssm_number', label: 'SSM registration no.', blocking: true , clientFacing: true },
      { key: 'point_of_contact', label: 'Single point of contact (name, phone, email)', blocking: true , clientFacing: true },
      { key: 'description', label: 'What they do, for whom, what makes them different', type: 'long' , clientFacing: true },
      { key: 'background', label: 'Year established, team size, service area' , clientFacing: true },
    ],
  },
  {
    key: 'branding',
    title: 'Branding & content',
    fields: [
      { key: 'logo', label: 'Logo file', type: 'files', blocking: true, hint: 'Vector/SVG ideal, big PNG acceptable' },
      { key: 'colours', label: 'Brand colours (if any)' },
      { key: 'photos', label: 'Photos of the business, team, and work', type: 'files', hint: 'Target 10+ good ones — chase early' },
      { key: 'materials', label: 'Existing copy, brochures, old website assets', type: 'files' },
      { key: 'brand_notes', label: 'Anything else about the brand' },
    ],
  },
  {
    key: 'contact',
    title: 'Contact, location & hours',
    fields: [
      { key: 'address', label: 'Address + Google Maps pin', blocking: true , clientFacing: true },
      { key: 'phone', label: 'Public phone / WhatsApp', blocking: true , clientFacing: true },
      { key: 'email', label: 'Public email' , clientFacing: true },
      { key: 'hours', label: 'Operating hours incl. public holidays' , clientFacing: true },
      { key: 'socials', label: 'Social links actually in use' , clientFacing: true },
    ],
  },
  {
    key: 'services',
    title: 'Services & pricing',
    fields: [
      { key: 'items', label: 'Services & prices', type: 'services', blocking: true, hint: 'One row per service. Price can be exact ("RM 150"), a range ("from RM 500"), or "ask for quote". Tick the ones customers can book online.' , clientFacing: true },
      { key: 'promos', label: 'Packages, promos, seasonal offers' , clientFacing: true },
    ],
  },
  {
    key: 'workflow',
    title: 'Workflow mapping',
    fields: [
      { key: 'lead_channels', label: 'How new customers reach you today', hint: 'e.g. WhatsApp, walk-in, Facebook, word of mouth', clientFacing: true },
      { key: 'pipeline_steps', label: 'Your process, step by step', type: 'workflow', blocking: true, hint: 'From the first time you hear from someone to the job being done and paid. List the steps in order, then add detail where you can — the detail is what lets us build it for you.', clientFacing: true },
      { key: 'lost_leads', label: 'Where do jobs or customers currently slip through the cracks?', type: 'long', hint: 'e.g. "we forget to follow up on quotes" — be honest, this is the part we can fix', clientFacing: true },
      { key: 'staff', label: 'Who works here and what should each person see?', type: 'long', hint: 'e.g. "Ah Meng runs the workshop and sees everything; two mechanics only need their own jobs"', clientFacing: true },
      { key: 'followups', label: 'Follow-ups you do today, or wish you did', hint: 'e.g. "we call a week after a service" or "we should ask for a Google review but never do"', clientFacing: true },
    ],
  },
  {
    key: 'booking',
    title: 'Booking rules',
    fields: [
      { key: 'slots', label: 'Slot length, buffer, max per day/staff' , clientFacing: true },
      { key: 'window', label: 'How far ahead bookable, minimum notice' , clientFacing: true },
      { key: 'cancellation', label: 'Cancellation / no-show policy' , clientFacing: true },
      { key: 'deposit', label: 'Deposit required? Amount + refund terms' , clientFacing: true },
    ],
  },
  {
    key: 'faq',
    title: 'FAQ & communication style',
    fields: [
      { key: 'questions', label: 'Top 10 questions customers actually ask', type: 'long', hint: 'Becomes the website FAQ' , clientFacing: true },
      { key: 'recipient', label: 'Who receives inquiries/bookings (name + WhatsApp/email)' , clientFacing: true },
      { key: 'languages', label: 'Languages: which supported, which primary' , clientFacing: true },
      { key: 'tone', label: 'Tone for website + follow-up emails' , clientFacing: true },
    ],
  },
  {
    key: 'access',
    title: 'Accounts & access',
    fields: [
      { key: 'domain', label: 'Domain: own one (access?) or new name agreed', blocking: true },
      { key: 'gbp', label: 'Google Business Profile access granted?', blocking: true, hint: 'Needed for reviews; clients drag on this' },
      { key: 'customer_list', label: 'Existing customer list (any format)', type: 'files' },
      { key: 'payments', label: 'Payment collection needs (deposits, gateway)' },
    ],
  },
  {
    key: 'compliance',
    title: 'Compliance & contract',
    fields: [
      { key: 'agreement', label: 'Agreement signed (lock-in, Managed terms)?', blocking: true },
      { key: 'pdpa', label: 'PDPA acknowledgment done?', blocking: true },
      { key: 'data_contact', label: 'Their data contact for deletion/correction requests' },
    ],
  },
]

function parseArray<T>(raw: string | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

// Tolerates both shapes: the current array of step objects, and the plain
// string[] this field held before it gained per-step detail. Old intakes keep
// working and simply carry no detail.
export function parseWorkflowSteps(raw: string | undefined): WorkflowStep[] {
  if (!raw || !raw.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw.trim() ? [{ name: raw.trim() }] : []
  }
  if (!Array.isArray(parsed)) return []
  const out: WorkflowStep[] = []
  for (const row of parsed) {
    if (typeof row === 'string') {
      if (row.trim()) out.push({ name: row.trim() })
      continue
    }
    if (row && typeof row === 'object') {
      const r = row as Record<string, unknown>
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      if (!name) continue
      const str = (k: string) =>
        typeof r[k] === 'string' && (r[k] as string).trim()
          ? (r[k] as string).trim()
          : undefined
      out.push({
        name,
        tasks: str('tasks'),
        who: str('who'),
        duration: str('duration'),
        blocker: str('blocker'),
        automatic: str('automatic'),
      })
    }
  }
  return out
}

export function fieldFilled(field: IntakeField, raw: string | undefined): boolean {
  const value = (raw ?? '').trim()
  if (value === '') return false
  if (field.type === 'services') {
    return parseArray<ServiceRow>(value).some((r) => r.name.trim() !== '')
  }
  if (field.type === 'workflow') {
    return parseWorkflowSteps(value).length > 0
  }
  if (field.type === 'steps') {
    return parseArray<string>(value).some((s) => s.trim() !== '')
  }
  if (field.type === 'files') {
    return parseArray<UploadedFile>(value).length > 0
  }
  return true
}

export function intakeProgress(data: IntakeData) {
  let filled = 0
  let total = 0
  const blockingMissing: string[] = []

  for (const section of INTAKE_SECTIONS) {
    for (const field of section.fields) {
      total += 1
      if (fieldFilled(field, data[`${section.key}.${field.key}`])) {
        filled += 1
      } else if (field.blocking) {
        blockingMissing.push(field.label)
      }
    }
  }

  return { filled, total, percent: Math.round((filled / total) * 100), blockingMissing }
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

export async function buildBrief(
  client: Client,
  data: IntakeData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<string> {
  const progress = intakeProgress(data)
  const lines: string[] = []

  lines.push(`# Build brief — ${client.company_name}`)
  lines.push('')
  lines.push(
    `Generated ${new Date().toISOString().slice(0, 10)} from Clancy HQ. File links are valid for 7 days.`
  )
  lines.push('')
  lines.push('## Client record')
  lines.push(`- Contact: ${client.contact_person ?? '—'} · ${client.phone ?? '—'} · ${client.email ?? '—'}`)
  lines.push(`- Vertical: ${client.vertical ?? '—'} · Source: ${client.source ?? '—'}`)
  lines.push(`- Tier: ${client.tier ?? '—'} · MRR: ${client.mrr !== null ? `RM ${client.mrr}` : '—'}`)
  lines.push(`- Lock-in start: ${client.lock_in_start ?? '—'} · Renewal: ${client.renewal_date ?? '—'}`)
  if (client.notes) {
    lines.push(`- Notes: ${client.notes}`)
  }
  lines.push('')

  if (progress.blockingMissing.length > 0) {
    lines.push('## ⚠ Blocking items still missing')
    for (const item of progress.blockingMissing) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  for (const section of INTAKE_SECTIONS) {
    const answered = section.fields.filter((f) =>
      fieldFilled(f, data[`${section.key}.${f.key}`])
    )
    lines.push(`## ${section.title}`)
    if (answered.length === 0) {
      lines.push('_No answers yet._')
      lines.push('')
      continue
    }
    for (const field of answered) {
      const raw = (data[`${section.key}.${field.key}`] ?? '').trim()

      if (field.type === 'services') {
        lines.push(`**${field.label}:**`)
        for (const row of parseArray<ServiceRow>(raw)) {
          if (row.name.trim() === '') continue
          let line = `- ${row.name} — ${row.price || 'price TBC'}`
          if (row.bookable) {
            line += ` · bookable online${row.duration ? ` (${row.duration})` : ''}`
          }
          lines.push(line)
        }
      } else if (field.type === 'steps') {
        lines.push(`**${field.label}:**`)
        parseArray<string>(raw)
          .filter((s) => s.trim() !== '')
          .forEach((step, i) => lines.push(`${i + 1}. ${step}`))
      } else if (field.type === 'files') {
        lines.push(`**${field.label}:**`)
        for (const file of parseArray<UploadedFile>(raw)) {
          const { data: signed } = await supabase.storage
            .from('intake-files')
            .createSignedUrl(file.path, SIGNED_URL_TTL_SECONDS)
          lines.push(`- ${file.name}${signed?.signedUrl ? `: ${signed.signedUrl}` : ' (stored in Clancy)'}`)
        }
      } else if (raw.includes('\n')) {
        lines.push(`**${field.label}:**`)
        lines.push(raw)
      } else {
        lines.push(`**${field.label}:** ${raw}`)
      }
      lines.push('')
    }
    lines.push('')
  }

  return lines.join('\n')
}

export const CLIENT_FACING_SECTIONS: IntakeSection[] = INTAKE_SECTIONS.map(
  (section) => ({
    ...section,
    fields: section.fields.filter((f) => f.clientFacing),
  })
).filter((section) => section.fields.length > 0)

export const CLIENT_FACING_KEYS = new Set(
  CLIENT_FACING_SECTIONS.flatMap((s) => s.fields.map((f) => `${s.key}.${f.key}`))
)


// The CRM build brief — the internal-management analogue of buildBrief. Hands
// Claude everything needed to configure the client's back-end CRM: record
// type, pipeline stages (from their real process), departments, and the
// fields worth tracking. Suggestions are flagged so Jacky confirms before I
// apply them.
// The workflow build brief — the process analogue of the CRM brief. The CRM
// brief configures the SHAPE of a workspace (record type, fields, modules);
// this one configures the PROCESS (stages, per-stage checklists, who does
// what, what blocks, what should fire automatically).
//
// Everything here comes from the client's own words in the intake. Nothing is
// invented — where the intake is thin, the brief says so and asks, because a
// guessed workflow is worse than an admitted gap.
export function buildWorkflowBrief(
  client: Client,
  data: IntakeData,
  config: CrmConfig
): string {
  const lines: string[] = []
  const get = (k: string) => (data[k] ?? '').trim()
  const steps = parseWorkflowSteps(data['workflow.pipeline_steps'])

  lines.push(`# Workflow build brief — ${client.company_name}`)
  lines.push('')
  lines.push(
    `Generated ${new Date().toISOString().slice(0, 10)} from Clancy HQ. This configures their **process** — pipeline stages and the checklist that fires at each one. The CRM brief covers the shape of the workspace (record type, fields); the website has its own brief.`
  )
  lines.push('')

  lines.push('## What the business does')
  lines.push(get('basics.description') || '_Not captured in intake yet._')
  lines.push('')

  lines.push('## How work arrives')
  lines.push(get('workflow.lead_channels') || '_Not captured._')
  lines.push('')

  lines.push('## The process, in their words')
  if (steps.length === 0) {
    lines.push(
      '_No process captured yet._ Ask them to walk through one job from first contact to done, and write each step down. Without this there is nothing to build.'
    )
  } else {
    lines.push(
      `${steps.length} step${steps.length === 1 ? '' : 's'}. Each becomes a pipeline stage on \`/workflow\`; the tasks under it become that stage's checklist.`
    )
    lines.push('')
    steps.forEach((s, i) => {
      lines.push(`### ${i + 1}. ${s.name}`)
      lines.push(
        `- **What happens here:** ${s.tasks ? s.tasks.replace(/\n+/g, ' · ') : '_not given — ask, or leave the stage with no checklist_'}`
      )
      lines.push(`- **Who does it:** ${s.who ?? '_not given_'}`)
      lines.push(`- **How long it takes:** ${s.duration ?? '_not given_'}`)
      lines.push(
        `- **Must be finished before moving on:** ${s.blocker ?? '_nothing stated_'}`
      )
      if (s.automatic) {
        lines.push(`- **They want automatic:** ${s.automatic}`)
      }
      lines.push('')
    })
  }

  lines.push('## Where work currently slips')
  lines.push(get('workflow.lost_leads') || '_Not captured._')
  lines.push('')

  lines.push('## Follow-ups')
  lines.push(get('workflow.followups') || '_Not captured._')
  lines.push('')

  lines.push('## Who works here')
  lines.push(get('workflow.staff') || '_Not captured._')
  const depts = config.departments ?? []
  lines.push(
    depts.length > 0
      ? `**Departments already set:** ${depts.map((d) => d.name).join(', ')}`
      : '**Departments:** none set yet — create them if different teams should only see their own tasks.'
  )
  lines.push('')

  const wishes = steps.filter((s) => s.automatic)
  lines.push('## Automation wishlist')
  if (wishes.length === 0 && !get('workflow.followups')) {
    lines.push('_Nothing captured._')
  } else {
    lines.push(
      'Things they said should happen by itself. **Do not build a rule builder for this** — these are the candidates for specific, named automations, and this list is how we decide which to build first.'
    )
    wishes.forEach((s) => lines.push(`- At **${s.name}**: ${s.automatic}`))
    if (get('workflow.followups')) {
      lines.push(`- Follow-ups: ${get('workflow.followups')}`)
    }
  }
  lines.push('')

  lines.push('---')
  lines.push('')
  lines.push('## What to do with this')
  lines.push(
    '1. Configure the stages on `/workflow` in the order above, using their words for stage names — never rename their process into jargon.'
  )
  lines.push(
    "2. Turn each step's *what happens here* into checklist items on that stage. Split run-on sentences into separate tasks."
  )
  lines.push(
    '3. Set the department from *who does it*, and a due-in-days from *how long it takes* where a number is stated. Leave it blank rather than guessing.'
  )
  lines.push(
    '4. Tick **blocking** only where they actually said something must be finished first. Over-blocking is the fastest way to make people abandon the system.'
  )
  lines.push(
    '5. Leave the automation wishlist unbuilt for now — record it, and raise anything that recurs across clients as a candidate for a curated automation.'
  )
  lines.push(
    '6. Flag any gap marked _not given_ back to Jacky rather than inventing an answer.'
  )

  return lines.join('\n')
}

export function buildCrmBrief(
  client: Client,
  data: IntakeData,
  config: CrmConfig
): string {
  const lines: string[] = []
  const get = (k: string) => (data[k] ?? '').trim()

  lines.push(`# CRM build brief — ${client.company_name}`)
  lines.push('')
  lines.push(
    `Generated ${new Date().toISOString().slice(0, 10)} from Clancy HQ. This configures their internal back-end (records, stages, departments) — the website has its own brief.`
  )
  lines.push('')

  lines.push('## What the business does')
  lines.push(get('basics.description') || '_Not captured in intake yet._')
  lines.push('')

  lines.push('## Record type')
  const singular = config.record_singular || ''
  const plural = config.record_plural || ''
  if (singular) {
    lines.push(`Currently configured as **${singular} / ${plural}**.`)
  } else {
    lines.push(
      '_Not set yet._ Decide what one row on their board represents (e.g. Visitor, Job, Customer, Order) and its plural.'
    )
  }
  lines.push('')

  lines.push('## Pipeline stages')
  const steps = parseWorkflowSteps(data['workflow.pipeline_steps'])
  if (steps.length > 0) {
    lines.push(
      `Their process has ${steps.length} step${steps.length === 1 ? '' : 's'} — **see the Workflow brief**, which carries the stages plus what happens at each one. Listed here for context only:`
    )
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s.name}`))
  } else {
    lines.push(
      '_No process captured._ Fill the Workflow section of the intake — stages are configured from the Workflow brief, not this one.'
    )
  }
  lines.push('')

  lines.push('## Fields to track per record')
  const existing = Array.isArray(config.fields) ? config.fields : []
  if (existing.length > 0) {
    lines.push('Already configured:')
    for (const f of existing) {
      lines.push(`- ${f.label} (${f.type}${f.key ? `, key: ${f.key}` : ''})`)
    }
  } else {
    lines.push(
      '_None beyond the built-ins (name, phone, email, notes)._ Add the details this business needs — infer from the description and services, then confirm with Jacky.'
    )
  }
  lines.push('')

  lines.push('## Team & departments')
  lines.push(`**Staff / who needs access:** ${get('workflow.staff') || '—'}`)
  const depts = config.departments ?? []
  if (depts.length > 0) {
    lines.push(`**Departments set:** ${depts.map((d) => d.name).join(', ')}`)
  } else {
    lines.push(
      '**Departments:** none yet — if different teams should only see their own tasks, set them up on the Team page.'
    )
  }
  lines.push('')

  lines.push('## Follow-ups & where leads are lost')
  lines.push(`**Follow-ups they do / want:** ${get('workflow.followups') || '—'}`)
  lines.push(`**Where leads get lost today:** ${get('workflow.lost_leads') || '—'}`)
  lines.push('')

  lines.push('## Modules')
  const mods = config.modules ?? {}
  lines.push(`- Tasks: ${mods.tasks ? 'on' : 'off'}`)
  lines.push(`- Calendar: ${mods.calendar ? 'on' : 'off'}`)
  lines.push(
    '(Turn on whichever the business needs on the Customize page.)'
  )
  lines.push('')

  lines.push('## How to build from this')
  lines.push(
    '1. Set the record name + stages on Customize + Stages. 2. Add the tracked fields. 3. Set departments/roles on Team if needed. 4. Enable Tasks/Calendar as required. 5. Enable the website signup form so new records arrive automatically.'
  )

  return lines.join('\n')
}
