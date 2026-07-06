/**
 * Server-side email notifications for EHS submissions.
 *
 * Uses the Resend REST API directly (no SDK) — mirrors how the Notion sync
 * routes call the Notion REST API. Best-effort and fully env-gated: if
 * RESEND_API_KEY is unset, this is a no-op so the rest of the flow still works.
 *
 * Required env vars to enable:
 *   RESEND_API_KEY     — your Resend API key
 *   EHS_NOTIFY_EMAIL   — recipient (defaults to mark.starr@mytra.ai)
 *   EHS_NOTIFY_FROM    — verified sender, e.g. "Sage EHS <sage@mytra.ai>"
 *                        (defaults to Resend's onboarding sender for testing)
 */

import { fetchWithTimeout } from '@/lib/fetch-timeout'

const DEFAULT_RECIPIENT = 'mark.starr@mytra.ai'
const DEFAULT_SENDER = 'Sage EHS <onboarding@resend.dev>'

export interface EhsEmailAttachment {
  filename: string
  /** Base64 content (no data-URL prefix) */
  content: string
}

export interface EhsEmail {
  subject: string
  text: string
  /** Optional rich version — clients that can't render it fall back to text. */
  html?: string
  attachments?: EhsEmailAttachment[]
}

export type EmailOutcome = 'sent' | 'not-configured' | 'failed'

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

/**
 * Header-injection guard, applied at the chokepoint so every caller is
 * covered: user-supplied text (equipment names, project names) flows into
 * subjects, and a CR/LF there could smuggle extra headers if any downstream
 * layer treats the subject as a raw header line. Includes Unicode line
 * separators, which some mail stacks normalize to newlines.
 */
export function sanitizeSubject(subject: string): string {
  return subject.replace(/[\r\n\u2028\u2029]+/g, ' ').trim()
}

export async function sendEhsNotification({ subject, text, html, attachments }: EhsEmail): Promise<EmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return 'not-configured'

  const to = process.env.EHS_NOTIFY_EMAIL || DEFAULT_RECIPIENT
  const from = process.env.EHS_NOTIFY_FROM || DEFAULT_SENDER

  try {
    const res = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: sanitizeSubject(subject),
        text,
        ...(html ? { html } : {}),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      }),
    })
    if (!res.ok) {
      console.error('[email-notify] Resend error:', await res.text())
      return 'failed'
    }
    return 'sent'
  } catch (e) {
    console.error('[email-notify] unexpected error:', e instanceof Error ? e.message : e)
    return 'failed'
  }
}
