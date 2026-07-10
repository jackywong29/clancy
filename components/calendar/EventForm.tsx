'use client'

import { useState } from 'react'
import { addEvent } from '@/lib/actions'
import { REPEAT_OPTIONS, ALERT_OPTIONS } from '@/lib/recurrence'
import type { Client, Department, EventCategory } from '@/types/database'

const inputClass =
  'rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

export function EventForm({
  defaultDate,
  categories,
  departments,
  records,
}: {
  defaultDate: string
  categories: EventCategory[]
  departments: Department[]
  records: Pick<Client, 'id' | 'company_name'>[]
}) {
  const [open, setOpen] = useState(false)
  const [allDay, setAllDay] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
      >
        + New event
      </button>
    )
  }

  return (
    <form
      action={addEvent}
      className="mt-6 space-y-4 rounded-xl border border-ash/60 bg-carbon p-4"
    >
      <input
        name="title"
        required
        placeholder="Event title"
        className={`${inputClass} w-full text-base`}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="all_day"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="h-4 w-4 accent-violet"
        />
        All-day event
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ivory/60">Starts</label>
          <div className="flex gap-2">
            <input
              name="starts_on"
              type="date"
              required
              defaultValue={defaultDate}
              className={`${inputClass} flex-1`}
            />
            {!allDay && (
              <input
                name="event_time"
                type="time"
                className={inputClass}
                aria-label="Start time"
              />
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ivory/60">Ends</label>
          <div className="flex gap-2">
            <input
              name="ends_on"
              type="date"
              defaultValue={defaultDate}
              className={`${inputClass} flex-1`}
            />
            {!allDay && (
              <input
                name="end_time"
                type="time"
                className={inputClass}
                aria-label="End time"
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ivory/60">Repeat</label>
          <select name="repeat" defaultValue="none" className={`${inputClass} w-full`}>
            {REPEAT_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ivory/60">Alert</label>
          <select name="alert_minutes" defaultValue="" className={`${inputClass} w-full`}>
            {ALERT_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {categories.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-ivory/60">Category</label>
          <select name="category" defaultValue="" className={`${inputClass} w-full`}>
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {departments.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-ivory/60">
            Alert which departments
          </label>
          <div className="flex flex-wrap gap-3 rounded-lg border border-ash/50 bg-graphite p-3">
            {departments.map((d) => (
              <label key={d.key} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="alert_departments"
                  value={d.key}
                  className="h-4 w-4 accent-violet"
                />
                {d.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-ivory/60">
            Linked record (optional)
          </label>
          <select name="client_id" defaultValue="" className={`${inputClass} w-full`}>
            <option value="">None</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.company_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-ivory/60">Notes</label>
        <textarea
          name="details"
          rows={2}
          className={`${inputClass} w-full`}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-violet-deep px-5 py-2 text-sm font-medium text-white hover:bg-violet"
        >
          Add event
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-ash px-4 py-2 text-sm text-ivory/70 hover:border-violet hover:text-violet"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
