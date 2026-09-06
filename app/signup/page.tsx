import Link from 'next/link'
import { signUp } from '@/lib/actions'
import { GoogleSignIn } from '@/components/GoogleSignIn'
import { Wordmark } from '@/components/Wordmark'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ash/60 bg-carbon p-6 sm:p-8">
        <div className="mb-6 text-center">
          <Wordmark size="text-3xl" />
          <p className="mt-2 text-sm text-ivory/60">Create an account</p>
        </div>
        {params.sent ? (
          <p className="text-sm leading-relaxed text-ivory/80">
            Check your email — we sent a confirmation link. After confirming,
            sign in and Jacky will grant your access.
          </p>
        ) : (
          <>
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
            <form action={signUp} className="space-y-4">
              <div>
                <label
                  htmlFor="full_name"
                  className="mb-1 block text-sm font-medium"
                >
                  Full name
                </label>
                <input id="full_name" name="full_name" className={inputClass} />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className={inputClass}
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
                  minLength={8}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              {params.error && (
                <p className="text-sm text-red-400">
                  Couldn&apos;t create the account. Try a different email or a
                  longer password.
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-violet-deep px-4 py-2.5 text-sm font-medium text-white hover:bg-violet"
              >
                Create account
              </button>
            </form>
          </>
        )}
        <p className="mt-4 text-center text-sm text-ivory/60">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-violet">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
