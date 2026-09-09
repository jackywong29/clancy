'use client'

import { useMemo, useState } from 'react'

// Filtering and search run in the browser over the list the server already
// sent. They used to be URL state (`?f=records&q=…`), so every chip click was
// a full server render — re-authenticating, re-reading the profile and org,
// and re-querying records, members and stages before anything appeared. The
// data for all five chips is the same data, so there is nothing to fetch.

export type PersonFilter = 'all' | 'records' | 'website' | 'manual' | 'team'

export interface Person {
  name: string
  kind: 'record' | 'member'
  viaWebsite: boolean
  detail: string
  email: string | null
  phone: string | null
  created: string
}

export function PeopleDirectory({
  people,
  plural,
}: {
  people: Person[]
  plural: string
}) {
  const [filter, setFilter] = useState<PersonFilter>('all')
  const [query, setQuery] = useState('')

  const chips = useMemo(() => {
    const records = people.filter((p) => p.kind === 'record')
    return [
      { key: 'all' as const, label: 'Everyone', count: people.length },
      { key: 'records' as const, label: plural, count: records.length },
      {
        key: 'website' as const,
        label: 'From the website',
        count: records.filter((p) => p.viaWebsite).length,
      },
      {
        key: 'manual' as const,
        label: 'Added manually',
        count: records.filter((p) => !p.viaWebsite).length,
      },
      {
        key: 'team' as const,
        label: 'Team',
        count: people.length - records.length,
      },
    ]
  }, [people, plural])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people.filter((p) => {
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
  }, [people, filter, query])

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            aria-pressed={filter === chip.key}
            className={`rounded-full px-3 py-2 text-xs sm:py-1.5 ${
              filter === chip.key
                ? 'bg-violet text-white'
                : 'border border-ash text-ivory/70 hover:border-violet hover:text-violet'
            }`}
          >
            {chip.label} · {chip.count}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone…"
          aria-label="Search people"
          className="w-full min-w-0 rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((p, i) => (
          <div
            key={`${p.kind}-${p.email ?? p.name}-${i}`}
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
              <p className="break-words text-xs text-ivory/60">{p.detail}</p>
            </div>
            <div className="min-w-0 text-xs text-ivory/50 sm:text-right">
              {p.email && <p className="break-all">{p.email}</p>}
              {p.phone && <p className="break-all">{p.phone}</p>}
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
    </>
  )
}
