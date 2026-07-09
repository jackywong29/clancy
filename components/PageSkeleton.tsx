// Instant navigation feedback: a static shell shown by loading.tsx while a
// server component fetches. Matches the dark app chrome so the header stays
// put and only the content area swaps to a pulse — nav feels immediate.
export function PageSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between border-b border-ash/60 bg-graphite px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="h-5 w-20 rounded bg-ash/40" />
          <div className="hidden gap-5 sm:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-14 rounded bg-ash/30" />
            ))}
          </div>
        </div>
        <div className="h-4 w-14 rounded bg-ash/30" />
      </div>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 h-7 w-40 rounded bg-ash/40" />
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-ash/60 bg-carbon"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
