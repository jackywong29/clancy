import nodemailer from 'nodemailer'

// Automated email via the Clancy Gmail account (clancy.hq.ai@gmail.com).
// Configured with two env vars: GMAIL_USER + GMAIL_APP_PASSWORD (a Google
// "App password", requires 2FA on the account). When absent, features fall
// back to mailto/copy flows. Gmail caps ~500 recipients/day — fine at this
// scale; swap to Resend + a real domain when clancy.my exists.

export function isEmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

export async function sendEmail({
  bcc,
  to,
  subject,
  text,
}: {
  bcc?: string[]
  to?: string[]
  subject: string
  text: string
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
      from: `Clancy <${process.env.GMAIL_USER}>`,
      to: to && to.length > 0 ? to : process.env.GMAIL_USER,
      bcc,
      subject,
      text,
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
