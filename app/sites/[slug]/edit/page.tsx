import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateSite, requireAdmin } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ServiceListEditor } from '@/components/intake/ServiceListEditor'
import { FaqListEditor } from '@/components/intake/FaqListEditor'
import { SocialsListEditor } from '@/components/intake/SocialsListEditor'
import { SiteLogoUpload } from '@/components/SiteLogoUpload'
import { ImageUpload } from '@/components/ImageUpload'
import { GalleryUpload } from '@/components/GalleryUpload'
import { ColorField } from '@/components/ColorField'
import { SubmitButton } from '@/components/SubmitButton'
import { SectionOrderEditor } from '@/components/SectionOrderEditor'
import { FONTS } from '@/lib/fonts'
import type { Site } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

const groupClass =
  'border-b border-ash/50 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ivory/50'

export default async function SiteEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const { slug } = await params
  const flags = await searchParams
  await requireAdmin()
  const supabase = await createClient()

  const { data: siteRow } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!siteRow) notFound()
  const site = siteRow as Site
  const config = site.config
  const orgId = site.organization_id

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-medium">{config.name ?? site.slug}</h1>
            <p className="mt-1 text-sm text-ivory/60">
              Site editor · /s/{site.slug}
            </p>
          </div>
          <Link href="/sites" className="text-sm text-ivory/60 hover:text-ivory">
            ← All sites
          </Link>
        </div>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved — changes are live immediately.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save{flags.msg ? `: ${flags.msg}` : '.'}
          </p>
        )}

        <form action={updateSite} className="space-y-4">
          <input type="hidden" name="slug" value={site.slug} />

          {/* ---------- Basics ---------- */}
          <h2 className={groupClass}>Basics</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Business name
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={config.name ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="tagline" className="mb-1 block text-sm font-medium">
                Tagline (the big headline)
              </label>
              <input
                id="tagline"
                name="tagline"
                defaultValue={config.tagline ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={config.description ?? ''}
              className={inputClass}
            />
          </div>

          {/* ---------- Sections & order ---------- */}
          <h2 className={groupClass}>Page sections & order</h2>
          <p className="-mt-1 text-xs text-ivory/50">
            This is the running order of the live page, top to bottom.
          </p>
          <SectionOrderEditor
            name="section_order"
            initial={JSON.stringify(config.section_order ?? [])}
          />

          {/* ---------- Contact ---------- */}
          <h2 className={groupClass}>Contact & location</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                Phone (shown on site)
              </label>
              <input
                id="phone"
                name="phone"
                defaultValue={config.phone ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="whatsapp" className="mb-1 block text-sm font-medium">
                WhatsApp (for Book buttons)
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                defaultValue={config.whatsapp ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="address" className="mb-1 block text-sm font-medium">
                Address
              </label>
              <input
                id="address"
                name="address"
                defaultValue={config.address ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="hours" className="mb-1 block text-sm font-medium">
                Hours
              </label>
              <input
                id="hours"
                name="hours"
                defaultValue={config.hours ?? ''}
                className={inputClass}
              />
            </div>
          </div>

          {/* ---------- Appearance ---------- */}
          <h2 className={groupClass}>Appearance</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Accent colour
              </label>
              <ColorField name="accent" initial={config.accent ?? '#5646E5'} />
            </div>
            <div>
              <label htmlFor="theme" className="mb-1 block text-sm font-medium">
                Theme
              </label>
              <select
                id="theme"
                name="theme"
                defaultValue={config.theme ?? 'light'}
                className={inputClass}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="font" className="mb-1 block text-sm font-medium">
                Font
              </label>
              <select
                id="font"
                name="font"
                defaultValue={config.font ?? 'sans'}
                className={inputClass}
              >
                {FONTS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
                <option value="custom">Custom (type a Google Font)…</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="font_custom"
                className="mb-1 block text-sm font-medium"
              >
                Custom font name
              </label>
              <input
                id="font_custom"
                name="font_custom"
                defaultValue={config.font_custom ?? ''}
                placeholder="e.g. Poppins"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ivory/50">
                Used only when Font = Custom. Any{' '}
                <a
                  href="https://fonts.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Google Font
                </a>{' '}
                name.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Background colour (optional — overrides the theme)
            </label>
            <ColorField
              name="bg_color"
              initial={config.bg_color ?? ''}
              allowEmpty
              placeholder="Leave blank to use theme"
            />
            <p className="mt-1 text-xs text-ivory/50">
              Text colour is auto-chosen for contrast.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Background image (optional)
              </label>
              <ImageUpload
                name="bg_image_url"
                initial={config.bg_image_url ?? ''}
                orgId={orgId}
                slug={site.slug}
                kind="bg"
                label="background"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Logo</label>
              <SiteLogoUpload
                name="logo_url"
                initial={config.logo_url ?? ''}
                orgId={orgId}
                slug={site.slug}
              />
              <div className="mt-2">
                <label
                  htmlFor="logo_position"
                  className="mb-1 block text-xs text-ivory/60"
                >
                  Logo position
                </label>
                <select
                  id="logo_position"
                  name="logo_position"
                  defaultValue={config.logo_position ?? 'left'}
                  className={inputClass}
                >
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                </select>
              </div>
            </div>
          </div>

          {/* ---------- Typography ---------- */}
          <h2 className={groupClass}>Typography</h2>
          <p className="-mt-1 text-xs text-ivory/50">
            Each text type can keep the site font above or override it, and be
            bold / italic / aligned independently.
          </p>
          {(
            [
              { key: 'headings', label: 'Headings', style: config.type_headings },
              { key: 'body', label: 'Body text', style: config.type_body },
              { key: 'buttons', label: 'Buttons', style: config.type_buttons },
            ] as const
          ).map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {row.label}
                </label>
                <select
                  name={`${row.key}_font`}
                  defaultValue={row.style?.font ?? ''}
                  aria-label={`${row.label} font`}
                  className={inputClass}
                >
                  <option value="">Inherit site font</option>
                  {FONTS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ivory/60">
                  Alignment
                </label>
                <select
                  name={`${row.key}_align`}
                  defaultValue={row.style?.align ?? ''}
                  aria-label={`${row.label} alignment`}
                  className={inputClass}
                >
                  <option value="">Default</option>
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`${row.key}_bold`}
                  defaultChecked={row.style?.bold ?? false}
                  className="h-4 w-4 accent-violet"
                />
                Bold
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`${row.key}_italic`}
                  defaultChecked={row.style?.italic ?? false}
                  className="h-4 w-4 accent-violet"
                />
                Italic
              </label>
            </div>
          ))}

          {/* ---------- Hero ---------- */}
          <h2 className={groupClass}>Hero</h2>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Hero image (optional — big photo behind the headline)
            </label>
            <ImageUpload
              name="hero_image_url"
              initial={config.hero_image_url ?? ''}
              orgId={orgId}
              slug={site.slug}
              kind="hero"
              label="hero image"
              className="h-16 w-28 rounded-lg object-cover"
            />
          </div>

          {/* ---------- Buttons & headings ---------- */}
          <h2 className={groupClass}>Buttons & headings</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="book_label" className="mb-1 block text-sm font-medium">
                Booking button text
              </label>
              <input
                id="book_label"
                name="book_label"
                defaultValue={config.book_label ?? ''}
                placeholder="Book now"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="service_book_label"
                className="mb-1 block text-sm font-medium"
              >
                Service button text
              </label>
              <input
                id="service_book_label"
                name="service_book_label"
                defaultValue={config.service_book_label ?? ''}
                placeholder="Book this"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="contact_method"
                className="mb-1 block text-sm font-medium"
              >
                Contact method
              </label>
              <select
                id="contact_method"
                name="contact_method"
                defaultValue={config.contact_method ?? 'whatsapp'}
                className={inputClass}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="contact_email"
                className="mb-1 block text-sm font-medium"
              >
                Contact email (for Email method)
              </label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                defaultValue={config.contact_email ?? ''}
                placeholder="hello@yourbusiness.com"
                className={inputClass}
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-ivory/50">
            Choose how the Book / service buttons reach you. Use{' '}
            <code>{'{name}'}</code> and <code>{'{service}'}</code> in any message
            below; leave blank for the defaults.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="book_message"
                className="mb-1 block text-sm font-medium"
              >
                WhatsApp — Book button
              </label>
              <textarea
                id="book_message"
                name="book_message"
                rows={2}
                defaultValue={config.book_message ?? ''}
                placeholder="Hi {name}, I'd like to make a booking."
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="service_message"
                className="mb-1 block text-sm font-medium"
              >
                WhatsApp — Service buttons
              </label>
              <textarea
                id="service_message"
                name="service_message"
                rows={2}
                defaultValue={config.service_message ?? ''}
                placeholder="Hi {name}, I'd like to book: {service}"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="email_subject"
                className="mb-1 block text-sm font-medium"
              >
                Email — Subject
              </label>
              <input
                id="email_subject"
                name="email_subject"
                defaultValue={config.email_subject ?? ''}
                placeholder="Booking enquiry — {name}"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="email_message"
                className="mb-1 block text-sm font-medium"
              >
                Email — Message
              </label>
              <textarea
                id="email_message"
                name="email_message"
                rows={2}
                defaultValue={config.email_message ?? ''}
                placeholder="Hi {name}, I'd like to make a booking."
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Section headings
            </label>
            <div className="grid gap-3 sm:grid-cols-4">
              <input
                name="services_title"
                defaultValue={config.services_title ?? ''}
                placeholder="Services"
                aria-label="Services heading"
                className={inputClass}
              />
              <input
                name="gallery_title"
                defaultValue={config.gallery_title ?? ''}
                placeholder="Gallery"
                aria-label="Gallery heading"
                className={inputClass}
              />
              <input
                name="find_us_title"
                defaultValue={config.find_us_title ?? ''}
                placeholder="Find us"
                aria-label="Find us heading"
                className={inputClass}
              />
              <input
                name="faq_title"
                defaultValue={config.faq_title ?? ''}
                placeholder="FAQ"
                aria-label="FAQ heading"
                className={inputClass}
              />
            </div>
            <p className="mt-1 text-xs text-ivory/50">
              Leave blank to use the default shown in each box.
            </p>
          </div>

          {/* ---------- About section ---------- */}
          <h2 className={groupClass}>About section (optional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="about_title" className="mb-1 block text-sm font-medium">
                Heading
              </label>
              <input
                id="about_title"
                name="about_title"
                defaultValue={config.about_title ?? ''}
                placeholder="e.g. Our story"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="about_image_side"
                className="mb-1 block text-sm font-medium"
              >
                Image side
              </label>
              <select
                id="about_image_side"
                name="about_image_side"
                defaultValue={config.about_image_side ?? 'left'}
                className={inputClass}
              >
                <option value="left">Image left</option>
                <option value="right">Image right</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="about_body" className="mb-1 block text-sm font-medium">
              Text
            </label>
            <textarea
              id="about_body"
              name="about_body"
              rows={3}
              defaultValue={config.about_body ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">About image</label>
            <ImageUpload
              name="about_image_url"
              initial={config.about_image_url ?? ''}
              orgId={orgId}
              slug={site.slug}
              kind="about"
              label="about image"
              className="h-16 w-28 rounded-lg object-cover"
            />
            <p className="mt-1 text-xs text-ivory/50">
              The About section only shows if you fill in a heading, text, or image.
            </p>
          </div>

          {/* ---------- Services ---------- */}
          <h2 className={groupClass}>Services</h2>
          <ServiceListEditor
            name="services"
            initial={JSON.stringify(config.services ?? [])}
          />

          {/* ---------- Gallery ---------- */}
          <h2 className={groupClass}>Photo gallery</h2>
          <GalleryUpload
            name="gallery"
            initial={JSON.stringify(config.gallery ?? [])}
            orgId={orgId}
            slug={site.slug}
          />

          {/* ---------- FAQ ---------- */}
          <h2 className={groupClass}>FAQ</h2>
          <FaqListEditor name="faq" initial={JSON.stringify(config.faq ?? [])} />

          {/* ---------- Social links ---------- */}
          <h2 className={groupClass}>Social links</h2>
          <SocialsListEditor
            name="socials"
            initial={JSON.stringify(config.socials ?? [])}
          />

          <label className="mt-2 flex items-center gap-2 rounded-xl border border-ash/60 bg-carbon p-4 text-sm">
            <input
              type="checkbox"
              name="published"
              defaultChecked={site.published}
              className="h-4 w-4 accent-violet"
            />
            Published — site is publicly visible at /s/{site.slug}
          </label>
          <SubmitButton className="w-full rounded-lg bg-violet-deep px-5 py-3 text-sm font-medium text-white hover:bg-violet">
            Save site
          </SubmitButton>
        </form>
      </main>
    </div>
  )
}
