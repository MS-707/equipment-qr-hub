/**
 * Server-side Slack notifications via Incoming Webhook.
 *
 * Env-gated: if SLACK_WEBHOOK_URL is unset, every call is a silent no-op.
 *
 * Required env var:
 *   SLACK_WEBHOOK_URL — Slack Incoming Webhook URL
 *                       (Settings → Apps → Incoming Webhooks → Add New)
 */

export type SlackOutcome = 'sent' | 'not-configured' | 'failed'

export function escapeSlack(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function isSlackConfigured(): boolean {
  return !!process.env.SLACK_WEBHOOK_URL
}

export async function sendSlackMessage(text: string): Promise<SlackOutcome> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return 'not-configured'

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.error('[slack-notify] webhook error:', res.status, await res.text())
      return 'failed'
    }
    return 'sent'
  } catch (e) {
    console.error('[slack-notify] unexpected error:', e instanceof Error ? e.message : e)
    return 'failed'
  }
}
