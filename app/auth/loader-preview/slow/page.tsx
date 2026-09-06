import Link from 'next/link'
import { notFound } from 'next/navigation'

// Dev-only. Sleeps server-side for ?ms= so the inherited root loading.tsx has
// something real to cover — the same boundary a 3-7s query triggers in prod.
export const dynamic = 'force-dynamic'

export default async function SlowPage({
  searchParams,
}: {
  searchParams: Promise<{ ms?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { ms } = await searchParams
  const delay = Math.min(Math.max(Number(ms) || 4000, 0), 20000)
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, delay)
  await promise

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-xl font-medium">Loaded after {delay / 1000}s</h1>
      <p className="mt-2 text-sm text-ivory/60">
        The brand loader covered the whole wait. Go back and try another delay.
      </p>
      <Link
        href="/auth/loader-preview"
        className="mt-6 inline-block rounded-lg border border-ash/60 px-4 py-2 text-sm hover:border-ivory/40"
      >
        Back to preview
      </Link>
    </main>
  )
}
