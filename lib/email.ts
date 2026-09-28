import 'server-only'
import nodemailer from 'nodemailer'

// Automated email via the Clancy Gmail account (clancy.hq.ai@gmail.com).
// Configured with two env vars: GMAIL_USER + GMAIL_APP_PASSWORD (a Google
// "App password", requires 2FA on the account). When absent, features fall
// back to mailto/copy flows. Gmail caps ~500 recipients/day — fine at this
// scale; swap to Resend + a real domain when clancy.my exists.

export function isEmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

// Gmail rejects messages over 25MB. We cap below that so the base64 encoding
// overhead (~33%) can't push a legal-looking upload over the real limit.
export const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024

// SMTP headers are line-delimited, so a CR or LF inside a value ends the
// header and starts a new one — the display name and the subject are the two
// values here that carry user-controlled text. Strip the delimiters (and the
// quoting/angle-bracket characters that would break out of the From phrase)
// rather than depending on the mail library to normalise them for us, and cap
// the name so a long value cannot push the header past what servers accept.
const MAX_FROM_NAME_CHARS = 78

const HEADER_BREAKS = /[\r\n]+/g

export interface MailAttachment {
  filename: string
  content: Buffer
  contentType?: string
  // Set for images embedded in the HTML body via <img src="cid:...">.
  cid?: string
}

export async function sendEmail({
  bcc,
  to,
  subject,
  text,
  html,
  attachments,
  fromName,
}: {
  bcc?: string[]
  to?: string[]
  subject: string
  text: string
  html?: string
  attachments?: MailAttachment[]
  fromName?: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: 'Email is not configured' }
  }

  const displayName =
    (fromName || 'Clancy')
      .replace(/["<>\\]/g, '')
      .replace(HEADER_BREAKS, ' ')
      .trim()
      .slice(0, MAX_FROM_NAME_CHARS)
      .trim() || 'Clancy'
  const safeSubject = subject.replace(HEADER_BREAKS, ' ')
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
    await transporter.sendMail({
      // Gmail SMTP always sends *from* the authenticated account; the display
      // name is the only part we control, so a broadcast can at least read as
      // the client's business rather than "Clancy".
      from: `${displayName} <${process.env.GMAIL_USER}>`,
      to: to && to.length > 0 ? to : process.env.GMAIL_USER,
      bcc,
      subject: safeSubject,
      text,
      html,
      attachments,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' }
  }
}

// Fill {token} placeholders in editable templates.
export function fillTokens(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}
