import assert from 'assert'
import { test } from './harness'
import { parseEmailList, mergeRecipients, audienceLabel } from '@/lib/audience'
import type { CrmConfig } from '@/types/database'

// Broadcast recipients (migration 018). parseEmailList is the guard between a
// pasted list and a real send, and createBroadcast refuses the whole broadcast
// if it reports anything invalid — so a false positive here blocks a send and a
// false negative mails a bad address.

const config = { record_plural: 'Visitors' } as CrmConfig
const noStage = () => null
const noDept = () => null

test('parseEmailList splits on commas, semicolons, newlines and spaces', () => {
  const { valid, invalid } = parseEmailList(
    'a@b.com, c@d.com; e@f.com\ng@h.com i@j.com'
  )
  assert.deepStrictEqual(valid, [
    'a@b.com',
    'c@d.com',
    'e@f.com',
    'g@h.com',
    'i@j.com',
  ])
  assert.deepStrictEqual(invalid, [])
})

test('parseEmailList takes the address out of a "Name <addr>" pair', () => {
  const { valid, invalid } = parseEmailList('Jacky Wong <jacky@clancy.my>')
  assert.deepStrictEqual(valid, ['jacky@clancy.my'])
  assert.deepStrictEqual(invalid, [])
})

test('parseEmailList survives an Outlook paste with a comma inside a quoted name', () => {
  // `"Wong, Jacky"` would otherwise split and report `"Wong` as invalid.
  const { valid, invalid } = parseEmailList(
    '"Wong, Jacky" <jacky@clancy.my>, "Lim, Ah Meng" <meng@shop.com>'
  )
  assert.deepStrictEqual(valid, ['jacky@clancy.my', 'meng@shop.com'])
  assert.deepStrictEqual(invalid, [])
})

test('parseEmailList dedupes case-insensitively, keeping the first spelling', () => {
  const { valid } = parseEmailList('Jacky@Clancy.my, jacky@clancy.my')
  assert.deepStrictEqual(valid, ['Jacky@Clancy.my'])
})

test('parseEmailList reports malformed addresses instead of dropping them', () => {
  const { valid, invalid } = parseEmailList('good@example.com, nope, bad@no-tld')
  assert.deepStrictEqual(valid, ['good@example.com'])
  assert.deepStrictEqual(invalid, ['nope', 'bad@no-tld'])
})

test('parseEmailList treats empty and separator-only input as no recipients', () => {
  for (const raw of ['', '   ', '\n', ',;, ,']) {
    assert.deepStrictEqual(
      parseEmailList(raw),
      { valid: [], invalid: [] },
      `unexpected result for ${JSON.stringify(raw)}`
    )
  }
})

test('mergeRecipients keeps the audience name for someone typed in as well', () => {
  const merged = mergeRecipients(
    [{ name: 'Ah Meng Workshop', email: 'meng@shop.com' }],
    ['MENG@shop.com', 'walkin@example.com']
  )
  assert.deepStrictEqual(merged, [
    { name: 'Ah Meng Workshop', email: 'meng@shop.com' },
    { name: 'walkin@example.com', email: 'walkin@example.com' },
  ])
})

test('mergeRecipients dedupes within the typed list too', () => {
  const merged = mergeRecipients([], ['a@b.com', 'A@B.com'])
  assert.deepStrictEqual(merged, [{ name: 'a@b.com', email: 'a@b.com' }])
})

test('audienceLabel names each audience with the workspace record label', () => {
  assert.strictEqual(
    audienceLabel('all', config, noStage, noDept),
    'All visitors with an email'
  )
  assert.strictEqual(
    audienceLabel('stage:s1', config, (id) => (id === 's1' ? 'Attending' : null), noDept),
    'Visitors: Attending'
  )
  assert.strictEqual(audienceLabel('team', config, noStage, noDept), 'Whole team')
  assert.strictEqual(
    audienceLabel('dept:kids', config, noStage, (k) => (k === 'kids' ? 'Kids' : null)),
    'Team: Kids'
  )
})

test('audienceLabel falls back rather than showing a raw id when a name is gone', () => {
  // A deleted stage or renamed department key must not leak "stage:uuid".
  assert.ok(!audienceLabel('stage:missing', config, noStage, noDept).includes('missing'))
  assert.ok(!audienceLabel('dept:gone', config, noStage, noDept).includes('gone'))
})

test('audienceLabel reports typed addresses, alone and on top of an audience', () => {
  assert.strictEqual(
    audienceLabel('custom', config, noStage, noDept, 1),
    '1 typed address'
  )
  assert.strictEqual(
    audienceLabel('custom', config, noStage, noDept, 3),
    '3 typed addresses'
  )
  assert.strictEqual(
    audienceLabel('team', config, noStage, noDept, 2),
    'Whole team + 2 typed'
  )
  assert.strictEqual(
    audienceLabel('all', config, noStage, noDept, 0),
    'All visitors with an email'
  )
})
