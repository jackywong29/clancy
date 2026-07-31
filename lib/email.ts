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
      from: `${(fromName || 'Clancy').replace(/["<>\\]/g, '')} <${process.env.GMAIL_USER}>`,
      to: to && to.length > 0 ? to : process.env.GMAIL_USER,
      bcc,
      subject,
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
