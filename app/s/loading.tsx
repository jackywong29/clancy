import { NeutralLoader } from '@/components/BrandLoader'

// Public client sites: a client's own website must never flash the Clancy
// wordmark while loading, so this overrides the root brand loader.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-ivory">
      <NeutralLoader />
    </div>
  )
}
