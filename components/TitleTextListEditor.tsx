'use client'

import { useState } from 'react'

interface Row {
  title: string
  text: string
}

function parse(initial: string): Row[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows)) return rows
  } catch {
    // default below
  }
  return []
}

const cell =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-1.5 text-sm outline-none focus:border-violet'

// Generic title + text row editor (landing features, steps, custom sections).
export function TitleTextListEditor({
  name,
  initial,
  titlePlaceholder = 'Title',
  textPlaceholder = 'Text',
  addLabel = '+ Add',
  textRows = 2,
}: {
  name: string
  initial: string
  titlePlaceholder?: string
  textPlaceholder?: string
  addLabel?: string
  textRows?: number
}) {
  const [rows, setRows] = useState<Row[]>(() => parse(initial))

  function update(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(rows.filter((r) => r.title.trim() !== ''))}
      />
      {rows.map((row, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-ash/60 bg-carbon/50 p-3"
        >
          <div className="flex items-center gap-2">
            <input
              value={row.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder={titlePlaceholder}
              className={cell}
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${row.title || 'row'}`}
              className="text-ivory/40 hover:text-red-400"
            >
              ×
            </button>
          </div>
          <textarea
            value={row.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder={textPlaceholder}
            rows={textRows}
            className={cell}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { title: '', text: '' }])}
        className="rounded-lg border border-dashed border-ash px-3 py-1.5 text-xs text-ivory/70 hover:border-violet hover:text-violet"
      >
        {addLabel}
      </button>
    </div>
  )
}
