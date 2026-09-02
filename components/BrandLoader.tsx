// Route-transition loaders. An RSC navigation gives no progress events, so
// these are indeterminate loops, not fake percentages.
//
// BrandLoader  — the clancy wordmark filling left-to-right (Clancy HQ surfaces).
// NeutralLoader — unbranded, inherits currentColor (public client sites, where
//                 showing the Clancy mark would brand someone else's website).
// RouteLoader  — full-page frame with a header placeholder, used by loading.tsx
//                so the chrome doesn't collapse and reflow mid-navigation.

export function BrandLoader({
  size = 'text-3xl',
  label,
}: {
  size?: string
  label?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3"
    >
      <span
        className={`relative inline-block select-none font-medium tracking-tight ${size}`}
      >
        {/* Unfilled track: the wordmark at low opacity, and the element that
            sets the box size the fill animates across. */}
        <span aria-hidden className="text-ivory/15">
          clancy<span className="text-violet/25">.</span>
        </span>
        {/* Fill: clipped to an animating width, text kept on one line so it is
            revealed rather than reflowed. */}
        <span
          aria-hidden
          className="animate-clancy-fill absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
        >
          <span className="text-ivory">
            clancy<span className="text-violet">.</span>
          </span>
        </span>
      </span>
      <span className="text-xs text-ivory/40">{label ?? 'Loading…'}</span>
    </div>
  )
}

export function NeutralLoader({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3"
    >
      <span aria-hidden className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-clancy-dot h-2 w-2 rounded-full bg-current"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </span>
      {label ? <span className="text-xs opacity-50">{label}</span> : null}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function RouteLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen">
      {/* Matches Header's height and border so the page doesn't jump when the
          real chrome mounts. */}
      <div className="flex items-center gap-3 border-b border-ash/60 bg-graphite px-4 py-3 sm:px-6 lg:gap-6">
        <div className="h-9 w-9 rounded-lg border border-ash/60 lg:hidden" />
        <div className="h-5 w-20 shrink-0 rounded bg-ash/40" />
        <div className="hidden gap-5 lg:flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-14 rounded bg-ash/30" />
          ))}
        </div>
        <div className="ml-auto h-4 w-14 rounded bg-ash/30" />
      </div>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <BrandLoader label={label} />
      </div>
    </div>
  )
}
