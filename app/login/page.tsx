import { signIn } from '@/lib/actions'
import { Wordmark } from '@/components/Wordmark'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-mist/50 bg-white p-8">
        <div className="mb-6 text-center">
          <Wordmark size="text-3xl" />
          <p className="mt-2 text-sm text-graphite/60">
            Built in days. Managed for you.
          </p>
        </div>
        <form action={signIn} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-mist bg-porcelain px-3 py-2 text-sm outline-none focus:border-violet"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-mist bg-porcelain px-3 py-2 text-sm outline-none focus:border-violet"
            />
          </div>
          {params.error && (
            <p className="text-sm text-red-600">
              Wrong email or password. Try again.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-deep px-4 py-2.5 text-sm font-medium text-white hover:bg-violet"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}
