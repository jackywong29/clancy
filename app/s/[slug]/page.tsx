import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Site, SiteConfig, SiteTheme } from '@/types/database'

// Colour tokens per theme. Layout stays in Tailwind; colours are inline so
// they can switch at runtime from config.theme. Reusable across all tenants.
function palette(theme: SiteTheme) {
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
  const c = palette(config.theme ?? 'light')
  const name = config.name ?? site.slug
  const book = waLink(config, `Hi ${name}, I'd like to make a booking.`)
  const services = (config.services ?? []).filter((s) => s.name.trim() !== '')
  const faq = (config.faq ?? []).filter((f) => f.q.trim() !== '')
  const socials = (config.socials ?? []).filter((s) => s.url.trim() !== '')
  const mapsHref = config.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`
    : null

  return (
    <div className="min-h-screen" style={{ background: c.bg, color: c.text }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
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
        {book && (
          <a
            href={book}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: accent }}
          >
            Book now
          </a>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-6">
        <section className="py-16 text-center sm:py-24">
          <h1 className="text-4xl font-medium leading-tight sm:text-5xl">
            {config.tagline ?? name}
          </h1>
          {config.description && (
            <p
              className="mx-auto mt-5 max-w-xl text-base leading-relaxed"
              style={{ color: c.muted }}
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
              Book via WhatsApp
            </a>
          )}
        </section>

        {services.length > 0 && (
          <section className="py-12" style={{ borderTop: `1px solid ${c.border}` }}>
            <h2 className="mb-6 text-2xl font-medium">Services</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="rounded-xl p-5"
                  style={{ background: c.surface, border: `1px solid ${c.border}` }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{service.name}</p>
                    <p className="shrink-0 text-sm" style={{ color: accent }}>
                      {service.price}
                    </p>
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
                      Book this
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="py-12" style={{ borderTop: `1px solid ${c.border}` }}>
          <h2 className="mb-6 text-2xl font-medium">Find us</h2>
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
          <section className="py-12" style={{ borderTop: `1px solid ${c.border}` }}>
            <h2 className="mb-6 text-2xl font-medium">
              Frequently asked questions
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
  )
}
