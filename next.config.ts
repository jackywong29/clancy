import path from 'node:path'
import type { NextConfig } from 'next'

// Pinned because a stray package-lock.json in the home directory makes
// Turbopack infer ~/ as the workspace root, which resolves modules from the
// wrong tree (the "stray npm install in the parent folder" breakage).

// The Supabase project origin: storage images and every API call go there, so
// it has to be named explicitly in img-src/connect-src. Falls back to the
// wildcard so a missing build-time env var degrades to a looser policy rather
// than one that blocks the app outright.
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return 'https://*.supabase.co'
  try {
    return new URL(raw).origin
  } catch {
    return 'https://*.supabase.co'
  }
})()

// Content-Security-Policy, shipped REPORT-ONLY on purpose.
//
// This app renders inline styles everywhere — the public site builds its whole
// palette as `style={{…}}` objects — and loads Google Fonts, so style-src has
// to allow 'unsafe-inline' and fonts.googleapis.com; font files come from
// fonts.gstatic.com; upload thumbnails are blob: object URLs; images and API
// traffic go to Supabase. Next's own bootstrap scripts are inline too.
//
// Report-only means violations are logged to the browser console and nothing
// is blocked. WATCH THE CONSOLE on /overview, /broadcasts (compose + review,
// with an attachment), /calendar and a live client site at /s/<slug>. Once a
// full pass through those produces no violations, rename the header to
// `Content-Security-Policy` to enforce it. Do not flip it on a guess: a wrong
// enforcing policy takes a paying client's website down.
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `connect-src 'self' ${supabaseOrigin}`,
]

// Applied everywhere, including the public client sites.
const baseSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  turbopack: { root: path.dirname(new URL(import.meta.url).pathname) },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: baseSecurityHeaders,
      },
      {
        // Everything except the public client sites. The session cookie is not
        // httpOnly (@supabase/ssr needs it readable), so the app's own pages
        // must never be framable.
        source: '/:path((?!s/).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [...cspDirectives, "frame-ancestors 'none'"].join('; '),
          },
        ],
      },
      {
        // A client's own website is a marketing page; embedding it in their
        // Facebook page or a booking widget is a plausible thing for them to
        // want, so it gets no frame restriction.
        source: '/s/:path*',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: cspDirectives.join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
