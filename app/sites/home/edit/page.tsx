import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateLanding, requireAdmin } from '@/lib/actions'
import { Header } from '@/components/Header'
import { TitleTextListEditor } from '@/components/TitleTextListEditor'
import { SubmitButton } from '@/components/SubmitButton'
import type { LandingConfig } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

const groupClass =
  'border-b border-ash/50 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ivory/50'

export default async function LandingEditPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const flags = await searchParams
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from('sites')
    .select('config')
    .eq('slug', 'clancy-home')
    .maybeSingle()
  const cfg = ((data?.config ?? {}) as LandingConfig) ?? {}

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium">Clancy homepage</h1>
            <p className="mt-1 text-sm text-ivory/60">
              What prospects see at clancy-hq.vercel.app
            </p>
          </div>
          <a href="/" target="_blank" className="text-sm text-ivory/60 hover:text-ivory">
            View live →
          </a>
        </div>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved — live immediately.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save{flags.msg ? `: ${flags.msg}` : '.'}
          </p>
        )}

        <form action={updateLanding} className="space-y-4">
          <h2 className={groupClass}>Hero</h2>
          <div>
            <label htmlFor="hero_title" className="mb-1 block text-sm font-medium">
              Headline (line breaks kept)
            </label>
            <textarea
              id="hero_title"
              name="hero_title"
              rows={2}
              defaultValue={cfg.hero_title ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="hero_sub" className="mb-1 block text-sm font-medium">
              Subheading
            </label>
            <textarea
              id="hero_sub"
              name="hero_sub"
              rows={2}
              defaultValue={cfg.hero_sub ?? ''}
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cta_label" className="mb-1 block text-sm font-medium">
                Button label
              </label>
              <input
                id="cta_label"
                name="cta_label"
                defaultValue={cfg.cta_label ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="cta_href" className="mb-1 block text-sm font-medium">
                Button link (mailto: or https:)
              </label>
              <input
                id="cta_href"
                name="cta_href"
                defaultValue={cfg.cta_href ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="badge_line" className="mb-1 block text-sm font-medium">
              Small line under the button
            </label>
            <input
              id="badge_line"
              name="badge_line"
              defaultValue={cfg.badge_line ?? ''}
              className={inputClass}
            />
          </div>

          <h2 className={groupClass}>Feature cards</h2>
          <TitleTextListEditor
            name="features"
            initial={JSON.stringify(cfg.features ?? [])}
            titlePlaceholder="Feature (e.g. Website)"
            textPlaceholder="One-line description"
            addLabel="+ Add feature"
          />

          <h2 className={groupClass}>How-it-works steps</h2>
          <TitleTextListEditor
            name="steps"
            initial={JSON.stringify(cfg.steps ?? [])}
            titlePlaceholder="Step (e.g. Walkthrough)"
            textPlaceholder="What happens in this step"
            addLabel="+ Add step"
            textRows={3}
          />

          <h2 className={groupClass}>Closing + footer</h2>
          <div>
            <label htmlFor="closing_title" className="mb-1 block text-sm font-medium">
              Closing headline
            </label>
            <input
              id="closing_title"
              name="closing_title"
              defaultValue={cfg.closing_title ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="closing_sub" className="mb-1 block text-sm font-medium">
              Closing text
            </label>
            <textarea
              id="closing_sub"
              name="closing_sub"
              rows={2}
              defaultValue={cfg.closing_sub ?? ''}
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="footer_line" className="mb-1 block text-sm font-medium">
                Footer line
              </label>
              <input
                id="footer_line"
                name="footer_line"
                defaultValue={cfg.footer_line ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="contact_email" className="mb-1 block text-sm font-medium">
                Contact email
              </label>
              <input
                id="contact_email"
                name="contact_email"
                defaultValue={cfg.contact_email ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="instagram_url" className="mb-1 block text-sm font-medium">
              Instagram URL
            </label>
            <input
              id="instagram_url"
              name="instagram_url"
              defaultValue={cfg.instagram_url ?? ''}
              className={inputClass}
            />
          </div>

          <SubmitButton
            pendingText="Saving…"
            className="w-full rounded-lg bg-violet-deep px-5 py-3 text-sm font-medium text-white hover:bg-violet"
          >
            Save homepage
          </SubmitButton>
        </form>
        <p className="mt-4 text-xs text-ivory/50">
          <Link href="/sites" className="hover:text-ivory">
            ← All sites
          </Link>
        </p>
      </main>
    </div>
  )
}
