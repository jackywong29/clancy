import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandLoader, NeutralLoader } from '@/components/BrandLoader'

// Dev-only preview of the route-transition loaders. Lives under /auth because
// proxy.ts already lets that prefix through unauthenticated, so it needs no
// Supabase session and no middleware change. 404s in production.
export default function LoaderPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-xl font-medium">Loading animation preview</h1>
      <p className="mt-2 text-sm text-ivory/60">
        Dev only. The links below render real pages that sleep on the server, so
        clicking them exercises the same <code>loading.tsx</code> boundary a slow
        Supabase query hits in production.
      </p>

      <section className="mt-10 rounded-xl border border-ash/60 bg-carbon p-8">
        <h2 className="mb-8 text-xs uppercase tracking-wide text-ivory/40">
          Brand loader — Clancy HQ pages
        </h2>
        <div className="flex flex-col items-center gap-10">
          <BrandLoader size="text-5xl" />
          <BrandLoader size="text-3xl" />
          <BrandLoader size="text-xl" label="Loading pipeline…" />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-ash/60 bg-carbon p-8">
        <h2 className="mb-8 text-xs uppercase tracking-wide text-ivory/40">
          Neutral loader — public client sites (no Clancy mark)
        </h2>
        <div className="flex justify-center text-ivory">
          <NeutralLoader />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-ash/60 bg-carbon p-6">
        <h2 className="text-xs uppercase tracking-wide text-ivory/40">
          Test a real navigation
        </h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {[1500, 4000, 7000].map((ms) => (
            <Link
              key={ms}
              href={`/auth/loader-preview/slow?ms=${ms}`}
              className="rounded-lg bg-violet-deep px-4 py-2 text-center text-sm font-medium text-white hover:bg-violet"
            >
              Navigate with a {ms / 1000}s server delay
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
