import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateSite, requireAdmin } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ServiceListEditor } from '@/components/intake/ServiceListEditor'
import { FaqListEditor } from '@/components/intake/FaqListEditor'
import { SocialsListEditor } from '@/components/intake/SocialsListEditor'
import { SiteLogoUpload } from '@/components/SiteLogoUpload'
import type { Site } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

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

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-medium">
              {config.name ?? site.slug}
            </h1>
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
              <label
                htmlFor="tagline"
                className="mb-1 block text-sm font-medium"
              >
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
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium"
            >
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
              <label
                htmlFor="whatsapp"
                className="mb-1 block text-sm font-medium"
              >
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
              <label
                htmlFor="address"
                className="mb-1 block text-sm font-medium"
              >
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
          <div className="flex items-end gap-4">
            <div>
              <label
                htmlFor="accent"
                className="mb-1 block text-sm font-medium"
              >
                Accent colour
              </label>
              <input
                id="accent"
                name="accent"
                type="color"
                defaultValue={config.accent ?? '#5646E5'}
                className="h-10 w-16 cursor-pointer rounded-lg border border-ash bg-graphite"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Logo</label>
              <SiteLogoUpload
                name="logo_url"
                initial={config.logo_url ?? ''}
                orgId={site.organization_id}
                slug={site.slug}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Services</label>
            <ServiceListEditor
              name="services"
              initial={JSON.stringify(config.services ?? [])}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">FAQ</label>
            <FaqListEditor
              name="faq"
              initial={JSON.stringify(config.faq ?? [])}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Social links
            </label>
            <SocialsListEditor
              name="socials"
              initial={JSON.stringify(config.socials ?? [])}
            />
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-ash/60 bg-carbon p-4 text-sm">
            <input
              type="checkbox"
              name="published"
              defaultChecked={site.published}
              className="h-4 w-4 accent-violet"
            />
            Published — site is publicly visible at /s/{site.slug}
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-deep px-5 py-3 text-sm font-medium text-white hover:bg-violet"
          >
            Save site
          </button>
        </form>
      </main>
    </div>
  )
}
