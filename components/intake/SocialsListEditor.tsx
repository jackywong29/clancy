'use client'

import { useState } from 'react'
import type { SiteSocial } from '@/types/database'

const PLATFORMS = [
  'Facebook',
  'Instagram',
  'YouTube',
  'TikTok',
  'WhatsApp',
  'Website',
]

function parse(initial: string): SiteSocial[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows) && rows.length > 0) return rows
  } catch {
    // fall through to default
  }
  return []
}

const cell =
  'rounded-lg border border-ash bg-graphite px-2 py-1.5 text-sm outline-none focus:border-violet'

export function SocialsListEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<SiteSocial[]>(() => parse(initial))

  function update(i: number, patch: Partial<SiteSocial>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(rows.filter((r) => r.url.trim() !== ''))}
      />
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[120px_1fr_28px] items-center gap-2"
        >
          <select
            value={row.platform}
            onChange={(e) => update(i, { platform: e.target.value })}
            className={cell}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={row.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://…"
            className={cell}
          />
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
            aria-label="Remove link"
            className="justify-self-end text-ivory/40 hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([...rows, { platform: 'Facebook', url: '' }])
        }
        className="rounded-lg border border-dashed border-ash px-3 py-1.5 text-xs text-ivory/70 hover:border-violet hover:text-violet"
      >
        + Add social link
      </button>
    </div>
  )
}
