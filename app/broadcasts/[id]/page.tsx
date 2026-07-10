import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { markBroadcastSent } from '@/lib/actions'
import { getMembership, hasRole } from '@/lib/permissions'
import { Header } from '@/components/Header'
import { CopyButton } from '@/components/CopyButton'
import type { Broadcast, Client } from '@/types/database'

const BATCH_SIZE = 40

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const m = await getMembership()
  if (!hasRole(m, 'editor')) redirect('/pipeline?denied=1')
  const supabase = await createClient()

  const { data: broadcastRow } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!broadcastRow) notFound()
  const broadcast = broadcastRow as Broadcast

  let query = supabase
    .from('clients')
    .select('id, company_name, email')
    .not('email', 'is', null)
    .neq('email', '')
    .order('company_name')
  if (broadcast.audience.startsWith('stage:')) {
    query = query.eq('stage_id', broadcast.audience.slice(6))
  }
  const { data: recipients } = await query
  const recipientList = (recipients ?? []) as Pick<
    Client,
    'id' | 'company_name' | 'email'
  >[]

  const emails = recipientList
    .map((r) => r.email)
    .filter((e): e is string => !!e)
  const batches: string[][] = []
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE))
  }
  const mailtoFor = (batch: string[]) =>
    `mailto:?bcc=${encodeURIComponent(batch.join(','))}&subject=${encodeURIComponent(broadcast.subject)}&body=${encodeURIComponent(broadcast.body)}`

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-medium">{broadcast.subject}</h1>
            <p className="mt-1 text-sm text-ivory/60">
              {broadcast.status === 'sent' ? 'Sent' : 'Ready to send'} ·{' '}
              {emails.length} recipient{emails.length === 1 ? '' : 's'}
            </p>
          </div>
          <Link
            href="/broadcasts"
            className="text-sm text-ivory/60 hover:text-ivory"
          >
            ← All broadcasts
          </Link>
        </div>

        <pre className="mb-6 whitespace-pre-wrap rounded-xl border border-ash/60 bg-carbon p-5 text-sm leading-relaxed">
          {broadcast.body}
        </pre>

        {broadcast.status !== 'sent' && (
          <div className="mb-6 space-y-3 rounded-xl border border-ash/60 bg-carbon p-4">
            <p className="text-sm font-medium">Send it</p>
            <p className="text-xs text-ivory/60">
              Each button opens a pre-filled email in your mail app with the
              recipients in BCC (so they can&apos;t see each other). Send each
              batch, then mark the broadcast as sent.
            </p>
            <div className="flex flex-wrap gap-2">
              {batches.map((batch, i) => (
                <a
                  key={i}
                  href={mailtoFor(batch)}
                  className="rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
                >
                  {batches.length === 1
                    ? `Open email (${batch.length} recipients)`
                    : `Batch ${i + 1} (${batch.length})`}
                </a>
              ))}
              {batches.length === 0 && (
                <p className="text-sm text-ivory/50">
                  No recipients have an email address yet.
                </p>
              )}
              <CopyButton
                text={emails.join(', ')}
                label="Copy all emails"
                variant="outline"
              />
            </div>
            <form action={markBroadcastSent}>
              <input type="hidden" name="broadcast_id" value={broadcast.id} />
              <button
                type="submit"
                className="rounded-lg border border-ash px-4 py-2 text-sm hover:border-violet hover:text-violet"
              >
                Mark as sent
              </button>
            </form>
          </div>
        )}

        <p className="mb-2 text-sm font-medium text-ivory/80">Recipients</p>
        <div className="space-y-1">
          {recipientList.map((r) => (
            <p key={r.id} className="text-sm text-ivory/70">
              {r.company_name}{' '}
              <span className="text-ivory/40">· {r.email}</span>
            </p>
          ))}
        </div>
      </main>
    </div>
  )
}
