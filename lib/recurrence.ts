import type { CalendarEvent, EventRepeat } from '@/types/database'

export const REPEAT_OPTIONS: { value: EventRepeat; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
]

export const ALERT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No alert' },
  { value: '0', label: 'At time of event' },
  { value: '10', label: '10 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]

// An expanded, concrete occurrence of a (possibly recurring) event on one date.
export interface EventOccurrence extends CalendarEvent {
  occurrenceDate: string // YYYY-MM-DD this instance falls on
}

function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Does a repeating event that starts on `start` land on `target`?
function occursOn(start: Date, target: Date, repeat: EventRepeat): boolean {
  if (target < start) return false
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000)
  switch (repeat) {
    case 'daily':
      return true
    case 'weekly':
      return days % 7 === 0
    case 'biweekly':
      return days % 14 === 0
    case 'monthly':
      return target.getDate() === start.getDate()
    case 'yearly':
      return (
        target.getDate() === start.getDate() &&
        target.getMonth() === start.getMonth()
      )
    default:
      return iso(start) === iso(target)
  }
}

// Expand events into concrete occurrences within [rangeStart, rangeEnd].
// Non-recurring events appear once; recurring ones appear on each hit.
export function expandEvents(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string
): EventOccurrence[] {
  const start = toDate(rangeStart)
  const end = toDate(rangeEnd)
  const out: EventOccurrence[] = []

  for (const ev of events) {
    const evStart = toDate(ev.starts_on)
    if ((ev.repeat ?? 'none') === 'none') {
      if (ev.starts_on >= rangeStart && ev.starts_on <= rangeEnd) {
        out.push({ ...ev, occurrenceDate: ev.starts_on })
      }
      continue
    }
    const cursor = new Date(Math.max(start.getTime(), evStart.getTime()))
    while (cursor <= end) {
      if (occursOn(evStart, cursor, ev.repeat)) {
        out.push({ ...ev, occurrenceDate: iso(cursor) })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return out
}
