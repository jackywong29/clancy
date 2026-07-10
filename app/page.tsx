import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Wordmark } from '@/components/Wordmark'
import type { LandingConfig } from '@/types/database'

// Everything on this page is editable in Clancy: Sites → Clancy homepage.
// These defaults render until the 'clancy-home' row exists / is edited.
const DEFAULTS: Required<
  Pick<
    LandingConfig,
    | 'hero_title'
    | 'hero_sub'
    | 'cta_label'
    | 'cta_href'
    | 'badge_line'
    | 'closing_title'
    | 'closing_sub'
    | 'footer_line'
    | 'instagram_url'
    | 'contact_email'
  >
> = {
  hero_title: 'Built in days.\nManaged for you.',
  hero_sub:
    'Your website, bookings, customer pipeline, and follow-ups — one system, built around how your business already works.',
  cta_label: 'Book a walkthrough',
  cta_href: 'mailto:clancy.hq.ai@gmail.com?subject=Clancy%20walkthrough',
  badge_line: 'Limited managed slots',
  closing_title: 'One system. One price. Zero setup fee.',
  closing_sub:
    "Every Clancy system is personally built and managed. That promise only works if we stay small — when the managed slots are full, there's a waitlist.",
  footer_line: 'clancy · Kuala Lumpur · by appointment',
  instagram_url: 'https://www.instagram.com/clancy.hq',
  contact_email: 'clancy.hq.ai@gmail.com',
}

const DEFAULT_FEATURES = [
  { title: 'Website', text: 'A clean, fast site that gets found on Google' },
  { title: 'Online booking', text: 'Customers book themselves in — even at 2am' },
  { title: 'Customer pipeline', text: 'Every inquiry tracked from first message to paid' },
  { title: 'Follow-ups', text: 'Automatic reminders so no lead is forgotten' },
  { title: 'Reviews', text: 'Review requests sent at the right moment, every time' },
]

const DEFAULT_STEPS = [
  {
    title: 'Walkthrough',
    text: 'We sit down and map how your business actually runs today — how customers find you, what happens next, where things slip.',
  },
  {
    title: 'We build',
    text: 'Your system goes live in days, not months — your services, your prices, your way of working. Try it free before you commit.',
  },
  {
    title: 'We manage',
    text: 'Updates, changes, and maintenance handled for you. You run the business; the system runs itself.',
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sites')
    .select('config')
    .eq('slug', 'clancy-home')
    .maybeSingle()

  const cfg = ((data?.config ?? {}) as LandingConfig) ?? {}
  const t = (key: keyof typeof DEFAULTS) =>
    (cfg[key] as string | undefined)?.trim() || DEFAULTS[key]
  const features =
    cfg.features && cfg.features.length > 0 ? cfg.features : DEFAULT_FEATURES
  const steps = cfg.steps && cfg.steps.length > 0 ? cfg.steps : DEFAULT_STEPS
  const contactHref = t('cta_href')

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Wordmark size="text-2xl" />
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-ivory/60 hover:text-ivory">
            Sign in
          </Link>
          <a
            href={contactHref}
            className="rounded-lg border border-ash px-4 py-2 text-sm hover:border-violet hover:text-violet"
          >
            {t('cta_label')}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        <section className="py-20 text-center sm:py-28">
          <h1 className="whitespace-pre-line text-4xl font-medium leading-tight sm:text-5xl">
            {t('hero_title')}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ivory/60">
            {t('hero_sub')}
          </p>
          <a
            href={contactHref}
            className="mt-8 inline-block rounded-lg bg-violet-deep px-6 py-3 text-sm font-medium text-white hover:bg-violet"
          >
            {t('cta_label')}
          </a>
          <p className="mt-4 text-xs text-ivory/40">{t('badge_line')}</p>
        </section>

        <section
          className="grid gap-3 border-t border-ash/60 py-14"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`,
          }}
        >
          {features.map((f) => (
            <div key={f.title} className="rounded-xl bg-carbon p-4">
              <p className="text-sm font-medium text-violet">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ivory/60">
                {f.text}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 border-t border-ash/60 py-14 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title}>
              <p className="text-sm font-medium text-violet">
                {i + 1} — {s.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ivory/60">
                {s.text}
              </p>
            </div>
          ))}
        </section>

        <section className="border-t border-ash/60 py-16 text-center">
          <h2 className="text-2xl font-medium">{t('closing_title')}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ivory/60">
            {t('closing_sub')}
          </p>
          <a
            href={contactHref}
            className="mt-6 inline-block rounded-lg bg-violet-deep px-6 py-3 text-sm font-medium text-white hover:bg-violet"
          >
            {t('cta_label')}
          </a>
        </section>
      </main>

      <footer className="border-t border-ash/60 py-8 text-center text-xs text-ivory/40">
        <p>{t('footer_line')}</p>
        <p className="mt-2">
          <a href={t('instagram_url')} className="hover:text-ivory">
            Instagram
          </a>
          <span className="mx-2">·</span>
          <a href={`mailto:${t('contact_email')}`} className="hover:text-ivory">
            {t('contact_email')}
          </a>
        </p>
      </footer>
    </div>
  )
}
