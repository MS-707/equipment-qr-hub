/**
 * Server-side Slack notifications via Incoming Webhook.
 *
 * Env-gated: if SLACK_WEBHOOK_URL is unset, every call is a silent no-op.
 *
 * Required env var:
 *   SLACK_WEBHOOK_URL — Slack Incoming Webhook URL
 *                       (Settings → Apps → Incoming Webhooks → Add New)
 */

import { fetchWithTimeout } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

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
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      reportServerError('lib/slack-notify', new Error(`webhook error ${res.status}: ${await res.text()}`))
      return 'failed'
    }
    return 'sent'
  } catch (e) {
    reportServerError('lib/slack-notify', e)
    return 'failed'
  }
}
