import { signOut } from '@/lib/actions'
import { Wordmark } from '@/components/Wordmark'

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-mist/50 bg-white p-8 text-center">
        <Wordmark size="text-3xl" />
        <h1 className="mt-6 text-lg font-medium">Access pending</h1>
        <p className="mt-2 text-sm leading-relaxed text-graphite/60">
          Your account exists but hasn&apos;t been given access to a workspace
          yet. Ask Jacky to grant it, then sign in again.
        </p>
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="rounded-lg border border-mist px-4 py-2 text-sm hover:border-violet hover:text-violet-deep"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
