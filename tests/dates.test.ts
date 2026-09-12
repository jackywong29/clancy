import assert from 'assert'
import { test } from './harness'
import { addDays, klToday, klYearMonth, klNow } from '@/lib/dates'

// Every checklist due date is addDays(klToday(), n) on a UTC server, so an
// off-by-one here is a task due on the wrong day for a Malaysian user.

test('addDays crosses month, year and leap-day boundaries', () => {
  assert.strictEqual(addDays('2026-01-31', 1), '2026-02-01')
  assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01')
  assert.strictEqual(addDays('2028-02-28', 1), '2028-02-29')
  assert.strictEqual(addDays('2026-02-28', 1), '2026-03-01')
})

test('addDays with 0 returns the same day, and accepts negatives', () => {
  assert.strictEqual(addDays('2026-09-08', 0), '2026-09-08')
  assert.strictEqual(addDays('2026-03-01', -1), '2026-02-28')
})

test('klToday is 8 hours ahead of UTC, so it can be tomorrow already', () => {
  // 2026-09-08 17:00 UTC is 2026-09-09 01:00 in Malaysia.
  const realNow = Date.now
  Date.now = () => Date.UTC(2026, 8, 8, 17, 0, 0)
  try {
    assert.strictEqual(klToday(), '2026-09-09')
    assert.strictEqual(klYearMonth(), '2026-09')
    assert.strictEqual(klNow().toISOString(), '2026-09-09T01:00:00.000Z')
  } finally {
    Date.now = realNow
  }
})

test('klToday rolls the month at 16:00 UTC on the last day', () => {
  const realNow = Date.now
  Date.now = () => Date.UTC(2026, 8, 30, 16, 0, 0)
  try {
    assert.strictEqual(klToday(), '2026-10-01')
    assert.strictEqual(klYearMonth(), '2026-10')
  } finally {
    Date.now = realNow
  }
})

test('klToday is unchanged for a UTC morning', () => {
  const realNow = Date.now
  Date.now = () => Date.UTC(2026, 8, 8, 3, 0, 0)
  try {
    assert.strictEqual(klToday(), '2026-09-08')
  } finally {
    Date.now = realNow
  }
})
