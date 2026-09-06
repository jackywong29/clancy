'use client'

import { useState } from 'react'
import type { ChecklistItem, Department } from '@/types/database'

// Editor for a stage's checklist — the tasks that appear on a record the
// moment it lands in this stage. Same shape as the other list editors on the
// Team page: rows in local state, serialised into one hidden input.

function parse(initial: string): ChecklistItem[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows)) {
      return rows.filter((r) => r && typeof r.title === 'string')
    }
  } catch {
    // fall through
  }
  return []
}

export function ChecklistEditor({
  name,
  initial,
  departments,
}: {
  name: string
  initial: string
  departments: Department[]
}) {
  const [items, setItems] = useState<ChecklistItem[]>(() => parse(initial))

  const update = (index: number, patch: Partial<ChecklistItem>) =>
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )

  const inputClass =
    'rounded-lg border border-ash bg-graphite px-2 py-1.5 text-sm outline-none focus:border-violet'

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(items)} />

      {items.map((item, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-ash/60 bg-graphite/50 p-2"
        >
          <div className="flex items-center gap-2">
            <input
              value={item.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="What needs doing"
              aria-label="Task title"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${item.title || 'item'}`}
              className="shrink-0 text-ivory/40 hover:text-red-400"
            >
              ×
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={item.department ?? ''}
              onChange={(e) =>
                update(i, { department: e.target.value || undefined })
              }
              aria-label="Department"
              className={inputClass}
            >
              <option value="">Anyone</option>
              {departments.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-ivory/60">
              Due in
              <input
                type="number"
                min="0"
                step="1"
                value={item.due_in_days ?? ''}
                onChange={(e) =>
                  update(i, {
                    due_in_days:
                      e.target.value === ''
                        ? undefined
                        : Math.max(0, Number(e.target.value)),
                  })
                }
                placeholder="—"
                aria-label="Due in days"
                className={`${inputClass} w-16`}
              />
              days
            </label>
            <label
              className="flex items-center gap-1.5 text-xs text-ivory/60"
              title="The record can't move forward until this is ticked"
            >
              <input
                type="checkbox"
                checked={item.blocking === true}
                onChange={(e) => update(i, { blocking: e.target.checked })}
                className="h-4 w-4 accent-violet"
              />
              Must finish first
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setItems([...items, { title: '' }])}
        className="rounded-lg border border-dashed border-ash px-3 py-1.5 text-xs text-ivory/70 hover:border-violet hover:text-violet"
      >
        + Add checklist item
      </button>
    </div>
  )
}
