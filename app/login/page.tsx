import Link from 'next/link'
import { signIn } from '@/lib/actions'
import { GoogleSignIn } from '@/components/GoogleSignIn'
import { Wordmark } from '@/components/Wordmark'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ash/60 bg-carbon p-6 sm:p-8">
        <div className="mb-6 text-center">
          <Wordmark size="text-3xl" />
          <p className="mt-2 text-sm text-ivory/60">
            Built in days. Managed for you.
          </p>
        </div>
        {params.error === 'oauth' && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Google sign-in failed
            {params.msg ? `: ${params.msg}` : '.'} Try again or use email
            below.
          </p>
        )}
        {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true' && (
          <>
            <GoogleSignIn />
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-ash/60" />
              <span className="text-xs text-ivory/40">or</span>
              <div className="h-px flex-1 bg-ash/60" />
            </div>
          </>
        )}
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
              className="w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet"
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
              className="w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet"
            />
          </div>
          {params.error === '1' && (
            <p className="text-sm text-red-400">
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
        <p className="mt-4 text-center text-sm text-ivory/60">
          New here?{' '}
          <Link href="/signup" className="font-medium text-violet">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
