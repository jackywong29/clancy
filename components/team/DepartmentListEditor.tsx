'use client'

import { useState } from 'react'
import type { Department } from '@/types/database'

function parse(initial: string): Department[] {
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

export function DepartmentListEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<Department[]>(() => parse(initial))

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(
          rows
            .filter((r) => r.name.trim() !== '')
            .map((r) => ({ key: r.key || slugify(r.name), name: r.name.trim() }))
        )}
      />
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={row.name}
            onChange={(e) =>
              setRows(
                rows.map((r, idx) =>
                  idx === i
                    ? { key: r.key || slugify(e.target.value), name: e.target.value }
                    : r
                )
              )
            }
            placeholder="Department name (e.g. Sales)"
            className="flex-1 rounded-lg border border-ash bg-graphite px-3 py-1.5 text-sm outline-none focus:border-violet"
          />
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
            aria-label={`Remove ${row.name || 'department'}`}
            className="text-ivory/40 hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { key: '', name: '' }])}
        className="rounded-lg border border-dashed border-ash px-3 py-1.5 text-xs text-ivory/70 hover:border-violet hover:text-violet"
      >
        + Add department
      </button>
    </div>
  )
}
