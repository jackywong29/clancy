import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { markAllNotificationsRead } from '@/lib/actions'
import { getMembership } from '@/lib/permissions'
import { Header } from '@/components/Header'
import type { NotificationItem } from '@/types/database'

export default async function NotificationsPage() {
  await getMembership()
  const supabase = await createClient()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const list = (notifications ?? []) as NotificationItem[]
  const unread = list.filter((n) => !n.read).length

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium">Inbox</h1>
            <p className="mt-1 text-sm text-ivory/60">
              Signups from the website and other workspace alerts.
            </p>
          </div>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
              >
                Mark all read
              </button>
            </form>
          )}
        </div>

        <div className="space-y-2">
          {list.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.read
                  ? 'border-ash/40 bg-carbon/50 opacity-70'
                  : 'border-violet/40 bg-carbon'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {!n.read && (
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-violet" />
                  )}
                  {n.title}
                </p>
                <p className="shrink-0 text-xs text-ivory/50">
                  {n.created_at.slice(0, 16).replace('T', ' ')}
                </p>
              </div>
              {n.body && (
                <p className="mt-1 text-sm text-ivory/70">{n.body}</p>
              )}
              {n.link && (
                <Link
                  href={n.link}
                  className="mt-2 inline-block text-xs text-violet hover:underline"
                >
                  Open →
                </Link>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <p className="rounded-xl border border-dashed border-ash bg-carbon/50 p-8 text-center text-sm text-ivory/60">
              Nothing yet. When someone signs up on the website, it lands
              here — and on the board.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
