import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Site, SiteConfig } from '@/types/database'

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
  const book = waLink(config, `Hi ${name}, I'd like to make a booking.`)
  const services = (config.services ?? []).filter((s) => s.name.trim() !== '')
  const faq = (config.faq ?? []).filter((f) => f.q.trim() !== '')
  const mapsHref = config.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`
    : null

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#221F1A]">
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
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#221F1A]/60">
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
          <section className="border-t border-[#221F1A]/10 py-12">
            <h2 className="mb-6 text-2xl font-medium">Services</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="rounded-xl border border-[#221F1A]/10 bg-white p-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{service.name}</p>
                    <p className="shrink-0 text-sm" style={{ color: accent }}>
                      {service.price}
                    </p>
                  </div>
                  {service.duration && (
                    <p className="mt-1 text-xs text-[#221F1A]/50">
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

        <section className="border-t border-[#221F1A]/10 py-12">
          <h2 className="mb-6 text-2xl font-medium">Find us</h2>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            {config.address && (
              <div>
                <p className="font-medium">Address</p>
                {mapsHref ? (
                  <a
                    href={mapsHref}
                    className="mt-1 block text-[#221F1A]/60 underline"
                  >
                    {config.address}
                  </a>
                ) : (
                  <p className="mt-1 text-[#221F1A]/60">{config.address}</p>
                )}
              </div>
            )}
            {config.hours && (
              <div>
                <p className="font-medium">Hours</p>
                <p className="mt-1 text-[#221F1A]/60">{config.hours}</p>
              </div>
            )}
            {config.phone && (
              <div>
                <p className="font-medium">Phone</p>
                <a
                  href={`tel:${config.phone.replace(/\D/g, '')}`}
                  className="mt-1 block text-[#221F1A]/60 underline"
                >
                  {config.phone}
                </a>
              </div>
            )}
          </div>
        </section>

        {faq.length > 0 && (
          <section className="border-t border-[#221F1A]/10 py-12">
            <h2 className="mb-6 text-2xl font-medium">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {faq.map((item) => (
                <div key={item.q}>
                  <p className="font-medium">{item.q}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#221F1A]/60">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[#221F1A]/10 py-8 text-center text-xs text-[#221F1A]/40">
        <a href="https://clancy-hq.vercel.app" className="hover:underline">
          Powered by clancy.
        </a>
      </footer>
    </div>
  )
}
