import type { BetaSignup, BetaStatus } from '@/lib/beta'

const RESEND_URL = 'https://api.resend.com/emails'

export async function sendBetaEmail(signup: BetaSignup, status: BetaStatus): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const from = process.env.EHS_NOTIFY_FROM || 'Sage EHS <onboarding@resend.dev>'
  const appUrl = process.env.NEXTAUTH_URL || 'https://sage-ehs.mytra.ai'

  if (status === 'approved') {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: signup.email,
        subject: `You're in — Welcome to the Sage EHS Beta`,
        text: [
          `Hey ${signup.name.split(' ')[0]},`,
          ``,
          `You've been approved for the Sage EHS beta. Welcome aboard.`,
          ``,
          `GET STARTED`,
          `1. Open ${appUrl} on your iPhone or iPad`,
          `2. Tap the Share button (box with arrow) > "Add to Home Screen"`,
          `3. Sign in with your company email (${signup.email})`,
          `4. Start your first Pre-Task Plan from the dashboard`,
          ``,
          `WHAT TO TEST`,
          `- Pre-Task Plans (PTP) — daily crew safety briefing`,
          `- Job Hazard Analysis (JHA) — step-by-step risk assessment`,
          `- Work permits — height, hot work, confined space`,
          `- Incident reporting — near-miss and injury reports`,
          `- Sage AI assistant — tap the purple chat bubble for safety guidance`,
          ``,
          `FEEDBACK`,
          `We want the unfiltered version. If something is confusing, broken,`,
          `or missing — tell us. Reply to this email or use the in-app feedback.`,
          ``,
          `Your data stays on your device during the beta (offline-first PWA).`,
          `Nothing leaves your phone unless you explicitly sync.`,
          ``,
          `Thanks for helping us build safer jobsites.`,
          ``,
          `— The Sage EHS Team`,
        ].join('\n'),
      }),
    }).catch((e) => console.error('[beta-email] send failed:', e))
  } else {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: signup.email,
        subject: `Sage EHS Beta — Update on your application`,
        text: [
          `Hi ${signup.name.split(' ')[0]},`,
          ``,
          `Thanks for your interest in Sage EHS. We're rolling out the beta`,
          `in small batches to ensure quality, and we're not able to include`,
          `your team in this round.`,
          ``,
          `We'll keep your info on file and reach out when the next batch opens.`,
          ``,
          `— The Sage EHS Team`,
        ].join('\n'),
      }),
    }).catch((e) => console.error('[beta-email] send failed:', e))
  }
}
