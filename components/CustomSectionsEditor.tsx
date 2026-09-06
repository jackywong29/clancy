'use client'

import { useState } from 'react'
import type { CustomSection } from '@/types/database'

function parse(initial: string): CustomSection[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows)) return rows
  } catch {
    // default below
  }
  return []
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const cell =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-1.5 text-sm outline-none focus:border-violet'

// User-defined site sections: a heading + body text each. Keys are stable
// 'custom-<slug>' identifiers so section ordering keeps working.
export function CustomSectionsEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<CustomSection[]>(() => parse(initial))

  function update(i: number, patch: Partial<CustomSection>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(
          (() => {
            const seen = new Set<string>()
            return rows
              .filter((r) => r.title.trim() !== '')
              .map((r) => {
                let key = r.key || `custom-${slugify(r.title)}`
                while (seen.has(key)) key = `${key}-2`
                seen.add(key)
                return { key, title: r.title.trim(), body: r.body }
              })
          })()
        )}
      />
      {rows.map((row, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-ash/60 bg-carbon/50 p-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <input
              value={row.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Section heading (e.g. Our story)"
              className={`${cell} min-w-0`}
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${row.title || 'section'}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 hover:text-red-400 sm:h-6 sm:w-6"
            >
              ×
            </button>
          </div>
          <textarea
            value={row.body}
            onChange={(e) => update(i, { body: e.target.value })}
            placeholder="Section text — line breaks are kept"
            rows={4}
            className={cell}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { key: '', title: '', body: '' }])}
        className="rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet sm:py-1.5"
      >
        + Add section
      </button>
    </div>
  )
}
