import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveFont, googleFontHref } from '@/lib/fonts'
import type { Site, SiteConfig, SiteTheme } from '@/types/database'

interface Palette {
  bg: string
  surface: string
  text: string
  border: string
  muted: string
  faint: string
}

// Base palette for the built-in themes.
function themePalette(theme: SiteTheme): Palette {
  return theme === 'dark'
    ? {
        bg: '#0C0C0F',
        surface: '#18181C',
        text: '#F5F1EA',
        border: 'rgba(245,241,234,0.12)',
        muted: 'rgba(245,241,234,0.60)',
        faint: 'rgba(245,241,234,0.40)',
      }
    : {
        bg: '#FAF8F3',
        surface: '#FFFFFF',
        text: '#221F1A',
        border: 'rgba(34,31,26,0.10)',
        muted: 'rgba(34,31,26,0.60)',
        faint: 'rgba(34,31,26,0.40)',
      }
}

// Relative luminance of a #hex colour (0 = black, 1 = white); null if unparseable.
function luminance(hex: string): number | null {
  const m = hex.replace('#', '').trim()
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (full.length !== 6) return null
  const parts = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  if (parts.some((n) => Number.isNaN(n))) return null
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const [r, g, b] = parts.map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Tokens for a custom background colour, with text auto-picked for contrast.
function overridePalette(bg: string, dark: boolean): Palette {
  return dark
    ? {
        bg,
        surface: 'rgba(255,255,255,0.06)',
        text: '#F5F1EA',
        border: 'rgba(245,241,234,0.14)',
        muted: 'rgba(245,241,234,0.62)',
        faint: 'rgba(245,241,234,0.42)',
      }
    : {
        bg,
        surface: 'rgba(0,0,0,0.03)',
        text: '#221F1A',
        border: 'rgba(34,31,26,0.12)',
        muted: 'rgba(34,31,26,0.60)',
        faint: 'rgba(34,31,26,0.42)',
      }
}

// Tokens used when a background image is set (dark overlay → light text).
function imagePalette(): Palette {
  return {
    bg: 'transparent',
    surface: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    border: 'rgba(255,255,255,0.18)',
    muted: 'rgba(255,255,255,0.75)',
    faint: 'rgba(255,255,255,0.55)',
  }
}

function waLink(config: SiteConfig, text: string) {
  const digits = (config.whatsapp ?? config.phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

async function getSite(slug: string): Promise<Site | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  return (data as Site | null) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) return { title: 'Not found' }
  return {
    title: site.config.name ?? site.slug,
    description: site.config.tagline ?? site.config.description ?? undefined,
  }
}

export default async function ClientSitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = await getSite(slug)
  if (!site) notFound()

  const config = site.config
  const accent = config.accent ?? '#5646E5'
  const name = config.name ?? site.slug
  const bookLabel = config.book_label?.trim() || 'Book now'
  const serviceBookLabel = config.service_book_label?.trim() || 'Book this'
  const logoCentered = config.logo_position === 'center'
  const book = waLink(config, `Hi ${name}, I'd like to make a booking.`)

  // Background + palette resolution: image > custom colour > theme.
  const bgImage = config.bg_image_url?.trim()
  const bgColor = config.bg_color?.trim()
  let c: Palette
  if (bgImage) {
    c = imagePalette()
  } else if (bgColor) {
    const lum = luminance(bgColor)
    c = lum === null ? themePalette(config.theme ?? 'light') : overridePalette(bgColor, lum < 0.5)
  } else {
    c = themePalette(config.theme ?? 'light')
  }

  const { google, stack } = resolveFont(config.font, config.font_custom)

  const services = (config.services ?? []).filter((s) => s.name.trim() !== '')
  const faq = (config.faq ?? []).filter((f) => f.q.trim() !== '')
  const socials = (config.socials ?? []).filter((s) => s.url.trim() !== '')
  const gallery = (config.gallery ?? []).filter((u) => u.trim() !== '')
  const heroImage = config.hero_image_url?.trim()
  const aboutImage = config.about_image_url?.trim()
  const hasAbout = !!(
    config.about_title?.trim() ||
    config.about_body?.trim() ||
    aboutImage
  )
  const aboutRight = config.about_image_side === 'right'
  const mapsHref = config.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`
    : null

  return (
    <div
      className="relative min-h-screen"
      style={{
        background: bgImage ? '#0C0C0F' : c.bg,
        color: c.text,
        fontFamily: stack,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontHref(google)} />

      {bgImage && (
        <>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: `url("${bgImage}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'rgba(6,6,8,0.68)' }}
          />
        </>
      )}

      <div className="relative">
        <header
          className={`mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-6 py-5 ${
            logoCentered ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-3">
            {config.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logo_url}
                alt={`${name} logo`}
                className="h-10 w-10 rounded-lg object-contain"
              />
            ) : null}
            <span className="text-lg font-medium">{name}</span>
          </div>
          {book && !logoCentered && (
            <a
              href={book}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: accent }}
            >
              {bookLabel}
            </a>
          )}
        </header>

        <main className="mx-auto max-w-3xl px-6">
          <section
            className={
              heroImage
                ? 'relative my-8 overflow-hidden rounded-2xl px-6 py-24 text-center sm:py-32'
                : 'py-16 text-center sm:py-24'
            }
          >
            {heroImage && (
              <>
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url("${heroImage}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: 'rgba(6,6,8,0.5)' }}
                />
              </>
            )}
            <div
              className="relative"
              style={heroImage ? { color: '#FFFFFF' } : undefined}
            >
              <h1 className="text-4xl font-medium leading-tight sm:text-5xl">
                {config.tagline ?? name}
              </h1>
              {config.description && (
                <p
                  className="mx-auto mt-5 max-w-xl text-base leading-relaxed"
                  style={{ color: heroImage ? 'rgba(255,255,255,0.85)' : c.muted }}
                >
                  {config.description}
                </p>
              )}
              {book && (
                <a
                  href={book}
                  className="mt-8 inline-block rounded-lg px-6 py-3 text-sm font-medium text-white"
                  style={{ background: accent }}
                >
                  {bookLabel}
                </a>
              )}
            </div>
          </section>

          {hasAbout && (
            <section
              className="py-12"
              style={{ borderTop: `1px solid ${c.border}` }}
            >
              <div className="grid items-center gap-8 sm:grid-cols-2">
                {aboutImage && (
                  <div className={aboutRight ? 'sm:order-2' : ''}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={aboutImage}
                      alt={config.about_title ?? 'About'}
                      className="w-full rounded-2xl object-cover"
                    />
                  </div>
                )}
                <div className={aboutRight ? 'sm:order-1' : ''}>
                  {config.about_title?.trim() && (
                    <h2 className="mb-3 text-2xl font-medium">
                      {config.about_title}
                    </h2>
                  )}
                  {config.about_body?.trim() && (
                    <p
                      className="whitespace-pre-line text-base leading-relaxed"
                      style={{ color: c.muted }}
                    >
                      {config.about_body}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {services.length > 0 && (
            <section
              className="py-12"
              style={{ borderTop: `1px solid ${c.border}` }}
            >
              <h2 className="mb-6 text-2xl font-medium">
                {config.services_title?.trim() || 'Services'}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <div
                    key={service.name}
                    className="rounded-xl p-5"
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">{service.name}</p>
                      {service.price.trim() && (
                        <p className="shrink-0 text-sm" style={{ color: accent }}>
                          {service.price}
                        </p>
                      )}
                    </div>
                    {service.duration && (
                      <p className="mt-1 text-xs" style={{ color: c.faint }}>
                        {service.duration}
                      </p>
                    )}
                    {service.bookable && book && (
                      <a
                        href={waLink(
                          config,
                          `Hi ${name}, I'd like to book: ${service.name}`
                        )!}
                        className="mt-3 inline-block rounded-lg border px-3 py-1.5 text-xs font-medium"
                        style={{ borderColor: accent, color: accent }}
                      >
                        {serviceBookLabel}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section
              className="py-12"
              style={{ borderTop: `1px solid ${c.border}` }}
            >
              <h2 className="mb-6 text-2xl font-medium">
                {config.gallery_title?.trim() || 'Gallery'}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt={`Photo ${i + 1}`}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            </section>
          )}

          <section
            className="py-12"
            style={{ borderTop: `1px solid ${c.border}` }}
          >
            <h2 className="mb-6 text-2xl font-medium">
              {config.find_us_title?.trim() || 'Find us'}
            </h2>
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              {config.address && (
                <div>
                  <p className="font-medium">Address</p>
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      className="mt-1 block underline"
                      style={{ color: c.muted }}
                    >
                      {config.address}
                    </a>
                  ) : (
                    <p className="mt-1" style={{ color: c.muted }}>
                      {config.address}
                    </p>
                  )}
                </div>
              )}
              {config.hours && (
                <div>
                  <p className="font-medium">Hours</p>
                  <p className="mt-1" style={{ color: c.muted }}>
                    {config.hours}
                  </p>
                </div>
              )}
              {config.phone && (
                <div>
                  <p className="font-medium">Phone</p>
                  <a
                    href={`tel:${config.phone.replace(/\D/g, '')}`}
                    className="mt-1 block underline"
                    style={{ color: c.muted }}
                  >
                    {config.phone}
                  </a>
                </div>
              )}
            </div>
          </section>

          {faq.length > 0 && (
            <section
              className="py-12"
              style={{ borderTop: `1px solid ${c.border}` }}
            >
              <h2 className="mb-6 text-2xl font-medium">
                {config.faq_title?.trim() || 'Frequently asked questions'}
              </h2>
              <div className="space-y-4">
                {faq.map((item) => (
                  <div key={item.q}>
                    <p className="font-medium">{item.q}</p>
                    <p
                      className="mt-1 text-sm leading-relaxed"
                      style={{ color: c.muted }}
                    >
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <footer
          className="py-8 text-center"
          style={{ borderTop: `1px solid ${c.border}` }}
        >
          {socials.length > 0 && (
            <div className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
              {socials.map((social) => (
                <a
                  key={social.url}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: c.muted }}
                >
                  {social.platform}
                </a>
              ))}
            </div>
          )}
          <a
            href="https://clancy-hq.vercel.app"
            className="text-xs hover:underline"
            style={{ color: c.faint }}
          >
            Powered by clancy.
          </a>
        </footer>
      </div>
    </div>
  )
}
