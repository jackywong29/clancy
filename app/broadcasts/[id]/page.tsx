import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { markBroadcastSent, sendBroadcastNow } from '@/lib/actions'
import { getMembership, hasRole } from '@/lib/permissions'
import { resolveAudience } from '@/lib/audience'
import { isEmailConfigured } from '@/lib/email'
import { Header } from '@/components/Header'
import { CopyButton } from '@/components/CopyButton'
import { SubmitButton } from '@/components/SubmitButton'
import type { Broadcast } from '@/types/database'

const BATCH_SIZE = 40

export default async function BroadcastDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; msg?: string }>
}) {
  const { id } = await params
  const flags = await searchParams
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

  const recipients = await resolveAudience(supabase, broadcast.audience)
  const emails = recipients.map((r) => r.email)
  const automated = isEmailConfigured()

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

        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {flags.msg ?? 'Something went wrong.'}
          </p>
        )}

        <pre className="mb-6 whitespace-pre-wrap rounded-xl border border-ash/60 bg-carbon p-5 text-sm leading-relaxed">
          {broadcast.body}
        </pre>

        {broadcast.status !== 'sent' && (
          <div className="mb-6 space-y-3 rounded-xl border border-ash/60 bg-carbon p-4">
            <p className="text-sm font-medium">Send it</p>
            {automated ? (
              <>
                <p className="text-xs text-ivory/60">
                  One click — Clancy emails everyone from the business address,
                  recipients in BCC so they can&apos;t see each other.
                </p>
                <form action={sendBroadcastNow}>
                  <input type="hidden" name="broadcast_id" value={broadcast.id} />
                  <SubmitButton
                    pendingText="Sending…"
                    className="rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
                  >
                    Send now to {emails.length} recipient
                    {emails.length === 1 ? '' : 's'}
                  </SubmitButton>
                </form>
              </>
            ) : (
              <>
                <p className="text-xs text-ivory/60">
                  Automated sending isn&apos;t set up yet (needs the Gmail app
                  password — ask Claude). Meanwhile, each button opens a
                  pre-filled email in your mail app with recipients in BCC.
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
              </>
            )}
          </div>
        )}

        <p className="mb-2 text-sm font-medium text-ivory/80">Recipients</p>
        <div className="space-y-1">
          {recipients.map((r, i) => (
            <p key={i} className="text-sm text-ivory/70">
              {r.name} <span className="text-ivory/40">· {r.email}</span>
            </p>
          ))}
        </div>
      </main>
    </div>
  )
}
