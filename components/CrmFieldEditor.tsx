'use client'

import { useState } from 'react'
import { CRM_FIELD_TYPES } from '@/lib/crm'
import type { CrmField } from '@/types/database'

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parse(initial: string): CrmField[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows)) return rows
  } catch {
    // default
  }
  return []
}

const cell =
  'rounded-lg border border-ash bg-graphite px-2 py-1.5 text-sm outline-none focus:border-violet'

export function CrmFieldEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<CrmField[]>(() => parse(initial))

  function update(i: number, patch: Partial<CrmField>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const clean = rows
    .filter((r) => r.label.trim() !== '')
    .map((r) => ({
      ...r,
      key: r.key || slugify(r.label),
      options:
        r.type === 'select'
          ? (r.options ?? []).filter((o) => o.trim() !== '')
          : undefined,
    }))

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(clean)} />
      {rows.map((row, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-ash/60 bg-carbon/50 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Field name (e.g. First visit)"
              className={`${cell} w-full min-w-0 sm:w-auto sm:flex-1`}
            />
            <select
              value={row.type}
              onChange={(e) =>
                update(i, { type: e.target.value as CrmField['type'] })
              }
              className={`${cell} min-w-0 flex-1 sm:flex-none`}
            >
              {CRM_FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              aria-label="Remove field"
              className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 hover:text-red-400 sm:h-6 sm:w-6"
            >
              ×
            </button>
          </div>
          {row.type === 'select' && (
            <input
              value={(row.options ?? []).join(', ')}
              onChange={(e) =>
                update(i, { options: e.target.value.split(',').map((o) => o.trim()) })
              }
              placeholder="Dropdown choices, comma-separated"
              className={`${cell} w-full`}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([...rows, { key: '', label: '', type: 'text' }])
        }
        className="rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet sm:py-1.5"
      >
        + Add field
      </button>
    </div>
  )
}
