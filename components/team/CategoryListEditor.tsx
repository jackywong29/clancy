'use client'

import { useState } from 'react'
import type { EventCategory } from '@/types/database'

const DEFAULT_COLORS = ['#6D5EF0', '#E2A33C', '#3CA96A', '#D85A70', '#3C8FE2']

function parse(initial: string): EventCategory[] {
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

export function CategoryListEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<EventCategory[]>(() => parse(initial))

  function update(i: number, patch: Partial<EventCategory>) {
    setRows(
      rows.map((r, idx) =>
        idx === i
          ? {
              ...r,
              ...patch,
              key: patch.name !== undefined ? r.key || slugify(patch.name) : r.key,
            }
          : r
      )
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(
          rows
            .filter((r) => r.name.trim() !== '')
            .map((r) => ({
              key: r.key || slugify(r.name),
              name: r.name.trim(),
              color: r.color || DEFAULT_COLORS[0],
            }))
        )}
      />
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="color"
            value={row.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            onChange={(e) => update(i, { color: e.target.value })}
            aria-label={`Colour for ${row.name || 'category'}`}
            className="h-9 w-12 cursor-pointer rounded-lg border border-ash bg-graphite"
          />
          <input
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Category (e.g. Service, Meeting)"
            className="flex-1 rounded-lg border border-ash bg-graphite px-3 py-1.5 text-sm outline-none focus:border-violet"
          />
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
            aria-label={`Remove ${row.name || 'category'}`}
            className="text-ivory/40 hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([
            ...rows,
            { key: '', name: '', color: DEFAULT_COLORS[rows.length % DEFAULT_COLORS.length] },
          ])
        }
        className="rounded-lg border border-dashed border-ash px-3 py-1.5 text-xs text-ivory/70 hover:border-violet hover:text-violet"
      >
        + Add category
      </button>
    </div>
  )
}
