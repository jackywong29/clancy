import Link from 'next/link'
import { signOut } from '@/lib/actions'
import { Wordmark } from '@/components/Wordmark'

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-mist/50 bg-porcelain px-6 py-3">
      <div className="flex items-center gap-8">
        <Link href="/pipeline">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/pipeline" className="font-medium">
            Pipeline
          </Link>
          <Link
            href="/clients/new"
            className="text-graphite/60 hover:text-graphite"
          >
            Add client
          </Link>
        </nav>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-graphite/60 hover:text-graphite"
        >
          Sign out
        </button>
      </form>
    </header>
  )
}
