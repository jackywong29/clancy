import type { Client } from '@/types/database'

// The client-intake checklist as data (see client-intake-checklist.md).
// Changing sections/fields here never needs a DB migration — intake answers
// live in intakes.data as JSON keyed by "<section>.<field>".

export interface IntakeField {
  key: string
  label: string
  long?: boolean
  blocking?: boolean
  hint?: string
}

export interface IntakeSection {
  key: string
  title: string
  fields: IntakeField[]
}

export type IntakeData = Record<string, string>

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    key: 'basics',
    title: '1. Business basics',
    fields: [
      { key: 'registered_name', label: 'Registered + trading name', blocking: true },
      { key: 'ssm_number', label: 'SSM registration no.', blocking: true },
      { key: 'point_of_contact', label: 'Single point of contact (name, phone, email)', blocking: true },
      { key: 'description', label: 'What they do, for whom, what makes them different', long: true },
      { key: 'background', label: 'Year established, team size, service area' },
    ],
  },
  {
    key: 'branding',
    title: '2. Branding & content',
    fields: [
      { key: 'logo', label: 'Logo — received? format?', blocking: true, hint: 'Vector/SVG ideal, big PNG acceptable' },
      { key: 'colours', label: 'Brand colours (if any)' },
      { key: 'photos', label: 'Photos — how many usable, what of?', hint: 'Target 10+; chase early' },
      { key: 'materials', label: 'Existing copy / brochures / old website to pull from', long: true },
    ],
  },
  {
    key: 'contact',
    title: '3. Contact, location & hours',
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
    title: '4. Services & pricing',
    fields: [
      { key: 'services_list', label: 'All services with one-line description + price each', blocking: true, long: true, hint: 'Mark per item: exact price / "from RM X" / ask for quote' },
      { key: 'bookable', label: 'Which are bookable online (duration, price, who performs)', long: true },
      { key: 'promos', label: 'Packages / promos / seasonal offers' },
    ],
  },
  {
    key: 'workflow',
    title: '5. Workflow mapping',
    fields: [
      { key: 'lead_channels', label: 'How new customers reach them today' },
      { key: 'pipeline_steps', label: 'Steps from first inquiry to paid (their real process)', long: true, hint: 'Becomes their 6–9 pipeline stages' },
      { key: 'lost_leads', label: 'Where leads currently get lost', long: true, hint: 'Pitch ammo — remember it' },
      { key: 'staff', label: 'Staff list: who needs a login, who sees what', long: true },
      { key: 'followups', label: 'Follow-ups they do today or wish they did' },
    ],
  },
  {
    key: 'booking',
    title: '6. Booking rules',
    fields: [
      { key: 'slots', label: 'Slot length, buffer, max per day/staff' },
      { key: 'window', label: 'How far ahead bookable, minimum notice' },
      { key: 'cancellation', label: 'Cancellation / no-show policy' },
      { key: 'deposit', label: 'Deposit required? Amount + refund terms' },
    ],
  },
  {
    key: 'faq',
    title: '7. FAQ & communication style',
    fields: [
      { key: 'questions', label: 'Top 10 questions customers actually ask', long: true, hint: 'Becomes the website FAQ' },
      { key: 'recipient', label: 'Who receives inquiries/bookings (name + WhatsApp/email)' },
      { key: 'languages', label: 'Languages: which supported, which primary' },
      { key: 'tone', label: 'Tone for website + follow-up emails' },
    ],
  },
  {
    key: 'access',
    title: '8. Accounts & access',
    fields: [
      { key: 'domain', label: 'Domain: own one (access?) or new name agreed', blocking: true },
      { key: 'gbp', label: 'Google Business Profile access granted?', blocking: true, hint: 'Needed for reviews; clients drag on this' },
      { key: 'customer_list', label: 'Existing customer list received (format)?' },
      { key: 'payments', label: 'Payment collection needs (deposits, gateway)' },
    ],
  },
  {
    key: 'compliance',
    title: '9. Compliance & contract',
    fields: [
      { key: 'agreement', label: 'Agreement signed (lock-in, Managed terms)?', blocking: true },
      { key: 'pdpa', label: 'PDPA acknowledgment done?', blocking: true },
      { key: 'data_contact', label: 'Their data contact for deletion/correction requests' },
    ],
  },
]

export function intakeProgress(data: IntakeData) {
  let filled = 0
  let total = 0
  const blockingMissing: string[] = []

  for (const section of INTAKE_SECTIONS) {
    for (const field of section.fields) {
      total += 1
      const value = (data[`${section.key}.${field.key}`] ?? '').trim()
      if (value !== '') {
        filled += 1
      } else if (field.blocking) {
        blockingMissing.push(field.label)
      }
    }
  }

  return { filled, total, percent: Math.round((filled / total) * 100), blockingMissing }
}

export function buildBrief(client: Client, data: IntakeData): string {
  const progress = intakeProgress(data)
  const lines: string[] = []

  lines.push(`# Build brief — ${client.company_name}`)
  lines.push('')
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} from Clancy HQ.`)
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
    const answered = section.fields.filter(
      (f) => (data[`${section.key}.${f.key}`] ?? '').trim() !== ''
    )
    lines.push(`## ${section.title}`)
    if (answered.length === 0) {
      lines.push('_No answers yet._')
    } else {
      for (const field of answered) {
        const value = data[`${section.key}.${field.key}`].trim()
        if (value.includes('\n')) {
          lines.push(`**${field.label}:**`)
          lines.push(value)
        } else {
          lines.push(`**${field.label}:** ${value}`)
        }
        lines.push('')
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
