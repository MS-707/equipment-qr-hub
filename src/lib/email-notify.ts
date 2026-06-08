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

const DEFAULT_RECIPIENT = 'mark.starr@mytra.ai'
const DEFAULT_SENDER = 'Sage EHS <onboarding@resend.dev>'

export interface EhsEmail {
  subject: string
  text: string
}

export type EmailOutcome = 'sent' | 'not-configured' | 'failed'

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEhsNotification({ subject, text }: EhsEmail): Promise<EmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return 'not-configured'

  const to = process.env.EHS_NOTIFY_EMAIL || DEFAULT_RECIPIENT
  const from = process.env.EHS_NOTIFY_FROM || DEFAULT_SENDER

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
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
