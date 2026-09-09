import { createClient } from '@/lib/supabase/server'
import { getMembership, roleLabel } from '@/lib/permissions'
import { recordLabel } from '@/lib/crm'
import { Header } from '@/components/Header'
import { PeopleDirectory, type Person } from '@/components/PeopleDirectory'
import type { WorkspaceRole } from '@/types/database'

// Filtering and search live in PeopleDirectory (client-side) — the list is the
// same for every chip, so switching filters must not cost a server round-trip.
// Columns are selected explicitly rather than `*`: this page only shows a
// name, contact details and a date, and the rest was pure payload.
export default async function PeoplePage() {
  const m = await getMembership()
  const supabase = await createClient()

  const [{ data: records }, { data: members }, { data: stages }] =
    await Promise.all([
      supabase
        .from('clients')
        .select('company_name, email, phone, source, stage_id, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('full_name, email, role, department, created_at')
        .order('created_at', { ascending: true }),
      supabase.from('pipeline_stages').select('id, name'),
    ])

  const stageList = (stages ?? []) as { id: string; name: string }[]
  const departments = m.crmConfig.departments ?? []
  const singular = recordLabel(m.crmConfig)
  const plural = recordLabel(m.crmConfig, true)

  const recordRows = (records ?? []) as {
    company_name: string
    email: string | null
    phone: string | null
    source: string | null
    stage_id: string | null
    created_at: string
  }[]
  const memberRows = (members ?? []) as {
    full_name: string | null
    email: string | null
    role: string | null
    department: string | null
    created_at: string
  }[]

  const people: Person[] = [
    ...recordRows.map((r) => {
      const stage = stageList.find((s) => s.id === r.stage_id)?.name ?? '—'
      return {
        name: r.company_name,
        kind: 'record' as const,
        viaWebsite: r.source === 'website form',
        detail: `${singular} · ${stage}${r.source ? ` · via ${r.source}` : ''}`,
        email: r.email,
        phone: r.phone,
        created: r.created_at,
      }
    }),
    ...memberRows.map((p) => {
      const dept = departments.find((d) => d.key === p.department)?.name ?? null
      return {
        name: p.full_name || p.email || 'Member',
        kind: 'member' as const,
        viaWebsite: false,
        detail: `Team · ${roleLabel(m.crmConfig, (p.role as WorkspaceRole) ?? 'viewer')}${dept ? ` · ${dept}` : ''}`,
        email: p.email,
        phone: null,
        created: p.created_at,
      }
    }),
  ]

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-medium">People</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Everyone connected to this workspace — {plural.toLowerCase()} from the
          website or added by hand, plus your team.
        </p>
        <PeopleDirectory people={people} plural={plural} />
      </main>
    </div>
  )
}
