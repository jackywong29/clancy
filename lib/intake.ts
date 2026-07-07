import type { SupabaseClient } from '@supabase/supabase-js'
import type { Client } from '@/types/database'

// The client-intake checklist as data (see client-intake-checklist.md).
// Changing sections/fields here never needs a DB migration — answers live
// in intakes.data as JSON keyed "<section>.<field>". Structured field types
// (services, steps, files) store JSON strings under the same keys.

export type IntakeFieldType = 'text' | 'long' | 'services' | 'steps' | 'files'

export interface IntakeField {
  key: string
  label: string
  type?: IntakeFieldType
  blocking?: boolean
  hint?: string
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

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    key: 'basics',
    title: 'Business basics',
    fields: [
      { key: 'registered_name', label: 'Registered + trading name', blocking: true },
      { key: 'ssm_number', label: 'SSM registration no.', blocking: true },
      { key: 'point_of_contact', label: 'Single point of contact (name, phone, email)', blocking: true },
      { key: 'description', label: 'What they do, for whom, what makes them different', type: 'long' },
      { key: 'background', label: 'Year established, team size, service area' },
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
      { key: 'address', label: 'Address + Google Maps pin', blocking: true },
      { key: 'phone', label: 'Public phone / WhatsApp', blocking: true },
      { key: 'email', label: 'Public email' },
      { key: 'hours', label: 'Operating hours incl. public holidays' },
      { key: 'socials', label: 'Social links actually in use' },
    ],
  },
  {
    key: 'services',
    title: 'Services & pricing',
    fields: [
      { key: 'items', label: 'Services & prices', type: 'services', blocking: true, hint: 'One row per service. Price can be exact ("RM 150"), a range ("from RM 500"), or "ask for quote". Tick the ones customers can book online.' },
      { key: 'promos', label: 'Packages, promos, seasonal offers' },
    ],
  },
  {
    key: 'workflow',
    title: 'Workflow mapping',
    fields: [
      { key: 'lead_channels', label: 'How new customers reach them today' },
      { key: 'pipeline_steps', label: 'Steps from first inquiry to paid', type: 'steps', hint: 'Their real process, in order — these become their pipeline stages' },
      { key: 'lost_leads', label: 'Where leads currently get lost', type: 'long', hint: 'Pitch ammo — remember it' },
      { key: 'staff', label: 'Staff list: who needs a login, who sees what', type: 'long' },
      { key: 'followups', label: 'Follow-ups they do today or wish they did' },
    ],
  },
  {
    key: 'booking',
    title: 'Booking rules',
    fields: [
      { key: 'slots', label: 'Slot length, buffer, max per day/staff' },
      { key: 'window', label: 'How far ahead bookable, minimum notice' },
      { key: 'cancellation', label: 'Cancellation / no-show policy' },
      { key: 'deposit', label: 'Deposit required? Amount + refund terms' },
    ],
  },
  {
    key: 'faq',
    title: 'FAQ & communication style',
    fields: [
      { key: 'questions', label: 'Top 10 questions customers actually ask', type: 'long', hint: 'Becomes the website FAQ' },
      { key: 'recipient', label: 'Who receives inquiries/bookings (name + WhatsApp/email)' },
      { key: 'languages', label: 'Languages: which supported, which primary' },
      { key: 'tone', label: 'Tone for website + follow-up emails' },
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

export function fieldFilled(field: IntakeField, raw: string | undefined): boolean {
  const value = (raw ?? '').trim()
  if (value === '') return false
  if (field.type === 'services') {
    return parseArray<ServiceRow>(value).some((r) => r.name.trim() !== '')
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
