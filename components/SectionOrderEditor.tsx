'use client'

import { useState } from 'react'
import { SECTION_KEYS, SECTION_LABELS, type SectionKey } from '@/lib/sections'

interface Row {
  key: SectionKey
  enabled: boolean
}

function initRows(initial: string): Row[] {
  let order: string[] = []
  try {
    const parsed = JSON.parse(initial)
    if (Array.isArray(parsed)) order = parsed
  } catch {
    // fall through to default
  }
  const known = (k: string): k is SectionKey =>
    (SECTION_KEYS as readonly string[]).includes(k)
  const enabled = order.filter(known)
  if (enabled.length === 0) {
    return SECTION_KEYS.map((key) => ({ key, enabled: true }))
  }
  const rest = SECTION_KEYS.filter((k) => !enabled.includes(k))
  return [
    ...enabled.map((key) => ({ key, enabled: true })),
    ...rest.map((key) => ({ key, enabled: false })),
  ]
}

// Reorder (▲▼) and show/hide the body sections. Saves the enabled keys in
// order as JSON; the site renders sections in exactly this order.
export function SectionOrderEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [rows, setRows] = useState<Row[]>(() => initRows(initial))
  const value = JSON.stringify(rows.filter((r) => r.enabled).map((r) => r.key))

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
  }

  function toggle(i: number) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, enabled: !r.enabled } : r)))
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      {rows.map((row, i) => (
        <div
          key={row.key}
          className="flex items-center gap-3 rounded-lg border border-ash/60 bg-carbon/50 px-3 py-2"
        >
          <div className="flex flex-col leading-none">
            <button
              type="button"
              aria-label={`Move ${SECTION_LABELS[row.key]} up`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="text-ivory/50 hover:text-violet disabled:opacity-25"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={`Move ${SECTION_LABELS[row.key]} down`}
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
              className="text-ivory/50 hover:text-violet disabled:opacity-25"
            >
              ▼
            </button>
          </div>
          <span
            className={`flex-1 text-sm ${
              row.enabled ? '' : 'text-ivory/40 line-through'
            }`}
          >
            {SECTION_LABELS[row.key]}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-ivory/70">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={() => toggle(i)}
              className="h-4 w-4 accent-violet"
            />
            Show
          </label>
        </div>
      ))}
      <p className="text-xs text-ivory/50">
        Use ▲▼ to reorder and untick “Show” to hide a section. Hero stays at the
        top and the footer at the bottom.
      </p>
    </div>
  )
}
