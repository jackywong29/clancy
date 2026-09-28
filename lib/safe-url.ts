// Shared validation for config-supplied URLs before they reach the browser.
//
// Site config is free text typed into the site editor, and the public page
// puts those values in two places React does not protect: inside a CSS
// `url("…")` value, and as a link/image target. React escapes the *attribute*,
// not the CSS string it contains, so a value carrying `"` or `)` closes the
// url() early and everything after it is parsed as further CSS declarations;
// and an `href` is only safe to follow if its scheme is one we intend.
//
// The invariant: a rendered URL parses as an absolute http(s) URL and contains
// no character that can terminate the CSS string it is interpolated into.
const CSS_BREAKERS = /["')(;\\]|[\r\n]/

export function safeUrl(value: string | null | undefined): string | null {
  // Tested before trimming: a newline anywhere in the stored value means the
  // value is not a URL someone typed into a single-line field.
  if (CSS_BREAKERS.test(value ?? '')) return null
  const url = value?.trim()
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return url
}

// A `mailto:` target is a fixed scheme, so it carries no XSS risk — but the
// address is interpolated ahead of the `?subject=`/`?body=` parameters, so an
// address containing `?`, `&` or a newline appends parameters of its own (a
// silent Bcc, a replaced body). The invariant: one plain address, no
// separators, nothing that can start a new parameter.
const PLAIN_EMAIL = /^[^\s@?&#,;"'<>()\\]+@[^\s@?&#,;"'<>()\\]+\.[A-Za-z]{2,}$/

export function safeEmail(value: string | null | undefined): string | null {
  const email = value?.trim()
  if (!email || !PLAIN_EMAIL.test(email)) return null
  return email
}
