import Link from 'next/link'
import { Wordmark } from '@/components/Wordmark'

// TODO: replace with the business WhatsApp link (wa.me/60…) once decided
const CONTACT_HREF =
  'mailto:jackywong0004@gmail.com?subject=Clancy%20walkthrough'

const FEATURES = [
  { title: 'Website', text: 'A clean, fast site that gets found on Google' },
  { title: 'Online booking', text: 'Customers book themselves in — even at 2am' },
  { title: 'Customer pipeline', text: 'Every inquiry tracked from first message to paid' },
  { title: 'Follow-ups', text: 'Automatic reminders so no lead is forgotten' },
  { title: 'Reviews', text: 'Review requests sent at the right moment, every time' },
]

const STEPS = [
  {
    n: '1',
    title: 'Walkthrough',
    text: 'We sit down and map how your business actually runs today — how customers find you, what happens next, where things slip.',
  },
  {
    n: '2',
    title: 'We build',
    text: 'Your system goes live in days, not months — your services, your prices, your way of working. Try it free before you commit.',
  },
  {
    n: '3',
    title: 'We manage',
    text: 'Updates, changes, and maintenance handled for you. You run the business; the system runs itself.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Wordmark size="text-2xl" />
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-ivory/60 hover:text-ivory">
            Sign in
          </Link>
          <a
            href={CONTACT_HREF}
            className="rounded-lg border border-ash px-4 py-2 text-sm hover:border-violet hover:text-violet"
          >
            Book a walkthrough
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        <section className="py-20 text-center sm:py-28">
          <h1 className="text-4xl font-medium leading-tight sm:text-5xl">
            Built in days.
            <br />
            Managed for you.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ivory/60">
            Your website, bookings, customer pipeline, and follow-ups — one
            system, built around how your business already works.
          </p>
          <a
            href={CONTACT_HREF}
            className="mt-8 inline-block rounded-lg bg-violet-deep px-6 py-3 text-sm font-medium text-white hover:bg-violet"
          >
            Book a walkthrough
          </a>
          <p className="mt-4 text-xs text-ivory/40">
            By the team running MegaStar Arena&apos;s systems · limited managed
            slots
          </p>
        </section>

        <section className="grid gap-3 border-t border-ash/60 py-14 sm:grid-cols-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl bg-carbon p-4">
              <p className="text-sm font-medium text-violet">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ivory/60">
                {f.text}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 border-t border-ash/60 py-14 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="text-sm font-medium text-violet">
                {s.n} — {s.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ivory/60">
                {s.text}
              </p>
            </div>
          ))}
        </section>

        <section className="border-t border-ash/60 py-16 text-center">
          <h2 className="text-2xl font-medium">
            One system. One price. Zero setup fee.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ivory/60">
            Every Clancy system is personally built and managed. That promise
            only works if we stay small — when the managed slots are full,
            there&apos;s a waitlist.
          </p>
          <a
            href={CONTACT_HREF}
            className="mt-6 inline-block rounded-lg bg-violet-deep px-6 py-3 text-sm font-medium text-white hover:bg-violet"
          >
            Book a walkthrough
          </a>
        </section>
      </main>

      <footer className="border-t border-ash/60 py-8 text-center text-xs text-ivory/40">
        clancy · Kuala Lumpur · by appointment
      </footer>
    </div>
  )
}
