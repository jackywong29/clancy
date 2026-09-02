'use client'

import { useState } from 'react'
import type { ServiceRow } from '@/lib/intake'

function parse(initial: string): ServiceRow[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows) && rows.length > 0) return rows
  } catch {
    // fall through to default
  }
  return [{ name: '', price: '', duration: '', bookable: false }]
}

const cell =
  'rounded-lg border border-ash bg-graphite px-2 py-1.5 text-sm outline-none focus:border-violet'

export function ServiceListEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<ServiceRow[]>(() => parse(initial))

  function update(i: number, patch: Partial<ServiceRow>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(rows.filter((r) => r.name.trim() !== ''))}
      />
      <div className="hidden gap-2 text-xs text-ivory/50 sm:grid sm:grid-cols-[1fr_130px_100px_90px_28px]">
        <span>Service</span>
        <span>Price</span>
        <span>Duration</span>
        <span>Bookable?</span>
        <span />
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-2 items-center gap-2 rounded-lg border border-ash/60 bg-carbon/50 p-2 sm:grid-cols-[1fr_130px_100px_90px_28px] sm:border-0 sm:bg-transparent sm:p-0"
        >
          <input
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="e.g. Full service"
            className={`${cell} col-span-2 sm:col-span-1`}
          />
          <input
            value={row.price}
            onChange={(e) => update(i, { price: e.target.value })}
            placeholder="RM 150 / from RM…"
            className={cell}
          />
          <input
            value={row.duration}
            onChange={(e) => update(i, { duration: e.target.value })}
            placeholder="45 min"
            className={cell}
          />
          <label className="flex items-center gap-1.5 text-xs text-ivory/70">
            <input
              type="checkbox"
              checked={row.bookable}
              onChange={(e) => update(i, { bookable: e.target.checked })}
              className="h-4 w-4 accent-violet"
            />
            online
          </label>
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
            aria-label="Remove service"
            className="flex h-8 w-8 items-center justify-center justify-self-end text-ivory/40 hover:text-red-400 sm:h-6 sm:w-6"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([...rows, { name: '', price: '', duration: '', bookable: false }])
        }
        className="rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet sm:py-1.5"
      >
        + Add service
      </button>
    </div>
  )
}
