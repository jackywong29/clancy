import type { BroadcastAttachment, EmailSignature } from '@/types/database'

// Renders a broadcast as an HTML email.
//
// Deliberately NOT styled with Tailwind or the app's dark theme: mail clients
// strip <style> blocks, ignore flexbox/grid, and render dark backgrounds
// badly (Outlook in particular). So this is table-based, inline-styled, and
// light — the shape every newsletter template has converged on for a reason.
// Every message also carries a plain-text alternative, which degrades cleanly
// and keeps the spam score down.

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export const DEFAULT_SIGN_OFF = 'Warm regards,'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// cid must be unique per message; the local part is arbitrary.
export function cidFor(index: number): string {
  return `clancy-inline-${index}`
}

// Escape, turn bare URLs into links, and preserve the author's line breaks.
// Trailing punctuation and quote entities are pushed back outside the link —
// otherwise "see https://example.com." links to a URL with a dot on the end.
function richText(body: string): string {
  return escapeHtml(body)
    .replace(/https?:\/\/[^\s<]+/g, (raw) => {
      const match = raw.match(/^(.*?)((?:&quot;|&gt;|&#39;|[.,;:!?)\]])*)$/)
      const url = match?.[1] || raw
      const trailing = match?.[2] ?? ''
      return `<a href="${url}" style="color:#5B3DF5;text-decoration:underline;">${url}</a>${trailing}`
    })
    .replace(/\n/g, '<br />')
}

export function hasSignature(sig?: EmailSignature): boolean {
  if (!sig || sig.enabled === false) return false
  return Boolean(
    sig.business_name ||
      sig.sender_name ||
      sig.tagline ||
      sig.phone ||
      sig.email ||
      sig.website ||
      sig.address ||
      sig.logo_url ||
      sig.footer_note
  )
}

function signatureHtml(sig: EmailSignature, logoCid?: string): string {
  const line = (
    content: string,
    style = 'margin:2px 0 0 0;font-size:13px;color:#6b6b76;'
  ) => `<p style="${style}">${content}</p>`

  const parts: string[] = []

  const signOff = sig.sign_off?.trim() || DEFAULT_SIGN_OFF
  if (sig.sender_name || signOff) {
    const name = sig.sender_name
      ? `<br /><strong style="color:#1a1a1f;">${escapeHtml(sig.sender_name)}</strong>`
      : ''
    const title = sig.sender_title
      ? `<br />${escapeHtml(sig.sender_title)}`
      : ''
    parts.push(
      line(
        `${escapeHtml(signOff)}${name}${title}`,
        'margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#33333a;'
      )
    )
  }

  if (sig.logo_url) {
    const src = logoCid ? `cid:${logoCid}` : escapeHtml(sig.logo_url)
    parts.push(
      `<img src="${src}" alt="${escapeHtml(sig.business_name || 'Logo')}" width="120" style="display:block;max-width:120px;height:auto;margin:0 0 10px 0;border:0;" />`
    )
  }

  if (sig.business_name) {
    parts.push(
      line(
        escapeHtml(sig.business_name),
        'margin:0;font-size:14px;font-weight:600;color:#1a1a1f;'
      )
    )
  }
  if (sig.tagline) {
    parts.push(
      line(
        escapeHtml(sig.tagline),
        'margin:2px 0 0 0;font-size:13px;font-style:italic;color:#8a8a95;'
      )
    )
  }

  const contact: string[] = []
  if (sig.phone) contact.push(escapeHtml(sig.phone))
  if (sig.email)
    contact.push(
      `<a href="mailto:${escapeHtml(sig.email)}" style="color:#6b6b76;text-decoration:none;">${escapeHtml(sig.email)}</a>`
    )
  if (contact.length) {
    parts.push(line(contact.join(' &nbsp;·&nbsp; '), 'margin:10px 0 0 0;font-size:13px;color:#6b6b76;'))
  }

  if (sig.website) {
    const href = /^https?:\/\//i.test(sig.website)
      ? sig.website
      : `https://${sig.website}`
    parts.push(
      line(
        `<a href="${escapeHtml(href)}" style="color:#5B3DF5;text-decoration:none;">${escapeHtml(sig.website)}</a>`
      )
    )
  }
  if (sig.address) parts.push(line(escapeHtml(sig.address).replace(/\n/g, '<br />')))

  if (sig.footer_note) {
    parts.push(
      line(
        escapeHtml(sig.footer_note).replace(/\n/g, '<br />'),
        'margin:18px 0 0 0;font-size:11px;line-height:1.5;color:#a0a0ab;'
      )
    )
  }

  return `<tr><td style="padding:8px 32px 32px 32px;">
    <div style="border-top:1px solid #e6e6ea;padding-top:20px;font-family:${FONT};">${parts.join('')}</div>
  </td></tr>`
}

export function renderBroadcastHtml({
  subject,
  body,
  signature,
  inlineImages = [],
  logoCid,
}: {
  subject: string
  body: string
  signature?: EmailSignature
  // Images embedded in the body. `cid` is set when the message is actually
  // being sent; the on-screen preview passes a browsable `src` instead.
  inlineImages?: { src: string; alt: string }[]
  logoCid?: string
}): string {
  const images = inlineImages
    .map(
      (img) =>
        `<tr><td style="padding:16px 32px 0 32px;">
          <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;border:0;" />
        </td></tr>`
    )
    .join('')

  const sig =
    signature && hasSignature(signature) ? signatureHtml(signature, logoCid) : ''

  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e6e6ea;border-radius:12px;">
  <tr><td style="padding:32px 32px 0 32px;font-family:${FONT};font-size:20px;line-height:1.35;font-weight:600;color:#1a1a1f;">${escapeHtml(subject)}</td></tr>
  <tr><td style="padding:16px 32px 0 32px;font-family:${FONT};font-size:15px;line-height:1.65;color:#33333a;">${richText(body)}</td></tr>
  ${images}
  ${sig}
</table>
</td></tr></table>
</body></html>`
}

function signatureText(sig: EmailSignature): string {
  const lines: string[] = ['', '--', sig.sign_off?.trim() || DEFAULT_SIGN_OFF]
  if (sig.sender_name) lines.push(sig.sender_name)
  if (sig.sender_title) lines.push(sig.sender_title)
  if (sig.business_name) lines.push('', sig.business_name)
  if (sig.tagline) lines.push(sig.tagline)
  const contact = [sig.phone, sig.email].filter(Boolean).join(' · ')
  if (contact) lines.push(contact)
  if (sig.website) lines.push(sig.website)
  if (sig.address) lines.push(sig.address)
  if (sig.footer_note) lines.push('', sig.footer_note)
  return lines.join('\n')
}

export function renderBroadcastText({
  body,
  signature,
  attachments = [],
  fileLinks = [],
}: {
  body: string
  signature?: EmailSignature
  attachments?: BroadcastAttachment[]
  // Signed download links, used in mail-app fallback mode where real
  // attachments are impossible.
  fileLinks?: { name: string; url: string }[]
}): string {
  let out = body
  if (fileLinks.length > 0) {
    out += `\n\nFiles:\n${fileLinks.map((f) => `${f.name}\n${f.url}`).join('\n\n')}`
  } else if (attachments.length > 0) {
    out += `\n\nAttached: ${attachments.map((a) => a.name).join(', ')}`
  }
  if (signature && hasSignature(signature)) out += signatureText(signature)
  return out
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImage(type: string): boolean {
  return type.startsWith('image/')
}
