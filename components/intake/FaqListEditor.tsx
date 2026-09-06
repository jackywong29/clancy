'use client'

import { useState } from 'react'

interface FaqRow {
  q: string
  a: string
}

function parse(initial: string): FaqRow[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows) && rows.length > 0) return rows
  } catch {
    // fall through to default
  }
  return []
}

const cell =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-1.5 text-sm outline-none focus:border-violet'

export function FaqListEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<FaqRow[]>(() => parse(initial))

  function update(i: number, patch: Partial<FaqRow>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(rows.filter((r) => r.q.trim() !== ''))}
      />
      {rows.map((row, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-ash/60 bg-carbon/50 p-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <input
              value={row.q}
              onChange={(e) => update(i, { q: e.target.value })}
              placeholder="Question"
              className={`${cell} min-w-0`}
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              aria-label="Remove question"
              className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 hover:text-red-400 sm:h-6 sm:w-6"
            >
              ×
            </button>
          </div>
          <textarea
            value={row.a}
            onChange={(e) => update(i, { a: e.target.value })}
            placeholder="Answer"
            rows={2}
            className={cell}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { q: '', a: '' }])}
        className="rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet sm:py-1.5"
      >
        + Add question
      </button>
    </div>
  )
}
