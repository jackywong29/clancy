// Malaysia-time helpers. Vercel servers run in UTC (8 hours behind MYT), so
// any "today" computed from new Date() flips a day early/late for Malaysian
// users. Malaysia has no DST — a fixed +8 offset is correct year-round.

const KL_OFFSET_MS = 8 * 60 * 60 * 1000

export function klNow(): Date {
  return new Date(Date.now() + KL_OFFSET_MS)
}

// YYYY-MM-DD of "today" in Malaysia.
export function klToday(): string {
  return klNow().toISOString().slice(0, 10)
}

// YYYY-MM of the current month in Malaysia.
export function klYearMonth(): string {
  return klToday().slice(0, 7)
}

// The instant the current Malaysian month began (1st, 00:00 MYT). Timestamps
// in the database are UTC, so "this month" filters must compare against this
// instant — not against a UTC month start, which is 8 hours late.
export function klMonthStart(): Date {
  return new Date(`${klYearMonth()}-01T00:00:00+08:00`)
}

// The Malaysian calendar date (YYYY-MM-DD) of a UTC timestamp.
export function klDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() + KL_OFFSET_MS)
    .toISOString()
    .slice(0, 10)
}

// Add whole days to a YYYY-MM-DD string, returning YYYY-MM-DD. Parsed as UTC
// midnight so the arithmetic can't be shifted by the server's own timezone.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
