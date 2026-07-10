import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMembership, roleLabel } from '@/lib/permissions'
import { recordLabel } from '@/lib/crm'
import { Header } from '@/components/Header'
import type {
  Client,
  PipelineStage,
  Profile,
  WorkspaceRole,
} from '@/types/database'

type Filter = 'all' | 'records' | 'website' | 'manual' | 'team'

interface Person {
  name: string
  kind: 'record' | 'member'
  viaWebsite: boolean
  detail: string
  email: string | null
  phone: string | null
  created: string
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>
}) {
  const flags = await searchParams
  const m = await getMembership()
  const supabase = await createClient()

  const [{ data: records }, { data: members }, { data: stages }] =
    await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase.from('pipeline_stages').select('*'),
    ])

  const recordList = (records ?? []) as Client[]
  const memberList = (members ?? []) as Profile[]
  const stageList = (stages ?? []) as PipelineStage[]
  const departments = m.crmConfig.departments ?? []
  const plural = recordLabel(m.crmConfig, true)
  const stageName = (id: string | null) =>
    stageList.find((s) => s.id === id)?.name ?? '—'
  const deptName = (key: string | null) =>
    departments.find((d) => d.key === key)?.name ?? null

  const people: Person[] = [
    ...recordList.map((r) => ({
      name: r.company_name,
      kind: 'record' as const,
      viaWebsite: r.source === 'website form',
      detail: `${recordLabel(m.crmConfig)} · ${stageName(r.stage_id)}${r.source ? ` · via ${r.source}` : ''}`,
      email: r.email,
      phone: r.phone,
      created: r.created_at,
    })),
    ...memberList.map((p) => ({
      name: p.full_name || p.email || 'Member',
      kind: 'member' as const,
      viaWebsite: false,
      detail: `Team · ${roleLabel(m.crmConfig, (p.role as WorkspaceRole) ?? 'viewer')}${deptName(p.department) ? ` · ${deptName(p.department)}` : ''}`,
      email: p.email,
      phone: null,
      created: p.created_at,
    })),
  ]

  const filter = (['all', 'records', 'website', 'manual', 'team'].includes(
    flags.f ?? ''
  )
    ? flags.f
    : 'all') as Filter
  const q = (flags.q ?? '').trim().toLowerCase()

  const filtered = people.filter((p) => {
    if (filter === 'records' && p.kind !== 'record') return false
    if (filter === 'website' && !(p.kind === 'record' && p.viaWebsite)) return false
    if (filter === 'manual' && !(p.kind === 'record' && !p.viaWebsite)) return false
    if (filter === 'team' && p.kind !== 'member') return false
    if (
      q &&
      !`${p.name} ${p.email ?? ''} ${p.phone ?? ''} ${p.detail}`
        .toLowerCase()
        .includes(q)
    )
      return false
    return true
  })

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Everyone', count: people.length },
    {
      key: 'records',
      label: plural,
      count: people.filter((p) => p.kind === 'record').length,
    },
    {
      key: 'website',
      label: 'From the website',
      count: people.filter((p) => p.kind === 'record' && p.viaWebsite).length,
    },
    {
      key: 'manual',
      label: 'Added manually',
      count: people.filter((p) => p.kind === 'record' && !p.viaWebsite).length,
    },
    {
      key: 'team',
      label: 'Team',
      count: people.filter((p) => p.kind === 'member').length,
    },
  ]

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">People</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Everyone connected to this workspace — {plural.toLowerCase()} from
          the website or added by hand, plus your team.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={`/people?f=${chip.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-3 py-1.5 text-xs ${
                filter === chip.key
                  ? 'bg-violet text-white'
                  : 'border border-ash text-ivory/70 hover:border-violet hover:text-violet'
              }`}
            >
              {chip.label} · {chip.count}
            </Link>
          ))}
        </div>

        <form method="get" className="mb-4 flex gap-2">
          <input type="hidden" name="f" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, phone…"
            className="flex-1 rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet"
          />
          <button
            type="submit"
            className="rounded-lg border border-ash px-4 py-2 text-sm hover:border-violet hover:text-violet"
          >
            Search
          </button>
        </form>

        <div className="space-y-2">
          {filtered.map((p, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-ash/60 bg-carbon p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.name}
                  {p.viaWebsite && (
                    <span className="ml-2 rounded bg-violet/10 px-1.5 py-0.5 text-xs font-normal text-violet">
                      website
                    </span>
                  )}
                </p>
                <p className="text-xs text-ivory/60">{p.detail}</p>
              </div>
              <div className="text-right text-xs text-ivory/50">
                {p.email && <p>{p.email}</p>}
                {p.phone && <p>{p.phone}</p>}
                <p className="text-ivory/40">{p.created.slice(0, 10)}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-ash bg-carbon/50 p-6 text-center text-sm text-ivory/60">
              No one matches — try another filter or search.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
