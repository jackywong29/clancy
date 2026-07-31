import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { markBroadcastSent, sendBroadcastNow } from '@/lib/actions'
import { getMembership, hasRole } from '@/lib/permissions'
import { resolveAudience } from '@/lib/audience'
import { isEmailConfigured } from '@/lib/email'
import {
  formatBytes,
  renderBroadcastHtml,
  renderBroadcastText,
} from '@/lib/broadcast-email'
import { Header } from '@/components/Header'
import { CopyButton } from '@/components/CopyButton'
import { SubmitButton } from '@/components/SubmitButton'
import { Paperclip } from 'lucide-react'
import type { Broadcast, BroadcastAttachment } from '@/types/database'

const BATCH_SIZE = 40
const LINK_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days, same as intake brief links

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
  const files: BroadcastAttachment[] = broadcast.attachments ?? []

  // The bucket is private, so both the on-screen preview and the mail-app
  // fallback links need short-lived signed URLs. Sending doesn't — that path
  // downloads the bytes server-side and attaches them directly.
  const signedByPath: Record<string, string> = {}
  if (files.length > 0) {
    const { data: signed } = await supabase.storage
      .from('broadcast-files')
      .createSignedUrls(
        files.map((f) => f.path),
        LINK_TTL_SECONDS
      )
    ;(signed ?? []).forEach((s, i) => {
      if (s.signedUrl) signedByPath[files[i].path] = s.signedUrl
    })
  }

  const previewHtml = renderBroadcastHtml({
    subject: broadcast.subject,
    body: broadcast.body,
    signature: m.crmConfig.signature,
    inlineImages: files
      .filter((f) => f.inline && signedByPath[f.path])
      .map((f) => ({ src: signedByPath[f.path], alt: f.name })),
    // Preview only: the real send swaps this for an embedded cid image.
  })

  // mailto: has no attachment parameter — that's the format, not our code.
  // So in fallback mode the files travel as signed download links in the body.
  const fileLinks = files
    .filter((f) => signedByPath[f.path])
    .map((f) => ({ name: f.name, url: signedByPath[f.path] }))
  const fallbackBody = renderBroadcastText({
    body: broadcast.body,
    signature: m.crmConfig.signature,
    fileLinks,
  })

  const batches: string[][] = []
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE))
  }
  const mailtoFor = (batch: string[]) =>
    `mailto:?bcc=${encodeURIComponent(batch.join(','))}&subject=${encodeURIComponent(broadcast.subject)}&body=${encodeURIComponent(fallbackBody)}`

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

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
              {files.length > 0 && (
                <>
                  {' '}
                  · {files.length} file{files.length === 1 ? '' : 's'} (
                  {formatBytes(totalBytes)})
                </>
              )}
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

        <p className="mb-2 text-sm font-medium text-ivory/80">
          Preview — this is what lands in their inbox
        </p>
        <iframe
          srcDoc={previewHtml}
          title="Email preview"
          sandbox=""
          className="mb-6 h-[520px] w-full rounded-xl border border-ash/60 bg-white"
        />

        {files.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-ivory/80">Files</p>
            <div className="space-y-1.5">
              {files.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center gap-2 rounded-lg border border-ash/60 bg-carbon px-3 py-2 text-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-ivory/40" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-ivory/50">
                    {f.inline ? 'in message' : 'attached'} · {formatBytes(f.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {broadcast.status !== 'sent' && (
          <div className="mb-6 space-y-3 rounded-xl border border-ash/60 bg-carbon p-4">
            <p className="text-sm font-medium">Send it</p>
            {automated ? (
              <>
                <p className="text-xs text-ivory/60">
                  One click — Clancy emails everyone from the business address,
                  recipients in BCC so they can&apos;t see each other.
                  {files.length > 0 &&
                    ' Files ride along as real attachments; images marked "in message" show inside the email.'}
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
                {files.length > 0 && (
                  <p className="rounded-lg bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                    Your mail app can&apos;t receive attachments from a link —
                    that&apos;s a limit of the format, not Clancy. The message
                    will carry download links instead (they expire in 7 days),
                    and the formatting and sign-off will be plain text. Set up
                    automated email to send real attachments.
                  </p>
                )}
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
