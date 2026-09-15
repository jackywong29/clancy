import assert from 'assert'
import { test } from './harness'
import { sessionExpiryFrom, looksSignedIn } from '@/lib/session-cookie'

// proxy.ts skips its network session check when this reports a token with time
// left on it, and the public landing page uses it to pick the nav label.
// Reading it wrong is the difference between "fast" and "signs you out
// mid-session", so every unparseable case must return null and fall back to
// the real validation.

const request = (cookies: Record<string, string>) =>
  Object.entries(cookies).map(([name, value]) => ({ name, value }))

const encode = (session: unknown) =>
  `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')}`

test('sessionExpiry reads the base64url session cookie', () => {
  const expires = Math.floor(Date.now() / 1000) + 3600
  assert.strictEqual(
    sessionExpiryFrom(request({ 'sb-abcdef-auth-token': encode({ expires_at: expires }) })),
    expires
  )
})

test('sessionExpiry reassembles chunked cookies in numeric order', () => {
  // .10 must follow .9, not sort between .1 and .2 — a lexicographic sort here
  // corrupts the JSON and silently logs the user out on every navigation.
  const expires = 1800000000
  const encoded = encode({ expires_at: expires, padding: 'x'.repeat(64) })
  const size = Math.ceil(encoded.length / 11)
  const cookies: Record<string, string> = {}
  for (let i = 0; i < 11; i += 1) {
    cookies[`sb-abcdef-auth-token.${i}`] = encoded.slice(i * size, (i + 1) * size)
  }
  assert.strictEqual(Object.keys(cookies).length, 11)
  assert.strictEqual(sessionExpiryFrom(request(cookies)), expires)
})

test('sessionExpiry reads the older URL-encoded JSON cookie', () => {
  const raw = encodeURIComponent(JSON.stringify({ expires_at: 1700000000 }))
  assert.strictEqual(
    sessionExpiryFrom(request({ 'sb-abcdef-auth-token': raw })),
    1700000000
  )
})

test('sessionExpiry ignores cookies that are not a Supabase session', () => {
  assert.strictEqual(sessionExpiryFrom(request({})), null)
  assert.strictEqual(sessionExpiryFrom(request({ 'other-cookie': 'x' })), null)
  assert.strictEqual(
    sessionExpiryFrom(request({ 'sb-abcdef-auth-token-code-verifier': 'x' })),
    null
  )
})

test('sessionExpiry returns null for anything it cannot parse', () => {
  // Every one of these must fall back to the network check, never be treated
  // as a valid session.
  for (const value of [
    'base64-not-base64!!',
    'base64-' + Buffer.from('{"expires_at":', 'utf8').toString('base64url'),
    encode({ expires_at: 'soon' }),
    encode({}),
    encode(null),
    '%E0%A4%A',
    '',
  ]) {
    assert.strictEqual(
      sessionExpiryFrom(request({ 'sb-abcdef-auth-token': value })),
      null,
      `expected null for ${JSON.stringify(value)}`
    )
  }
})

test('looksSignedIn is true only for an unexpired session cookie', () => {
  const future = encode({ expires_at: Math.floor(Date.now() / 1000) + 600 })
  const past = encode({ expires_at: Math.floor(Date.now() / 1000) - 600 })
  assert.strictEqual(looksSignedIn(request({ 'sb-abcdef-auth-token': future })), true)
  assert.strictEqual(looksSignedIn(request({ 'sb-abcdef-auth-token': past })), false)
  assert.strictEqual(looksSignedIn(request({})), false)
  assert.strictEqual(looksSignedIn(request({ 'sb-abcdef-auth-token': 'garbage' })), false)
})
