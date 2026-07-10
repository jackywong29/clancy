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
