/**
 * POST /api/safety/suggest-hazards  —  "Sage" hazard suggestions.
 *
 * DORMANT BY DEFAULT. The client (SageAssist) only calls this when
 * NEXT_PUBLIC_AI_ASSIST=1. This route additionally FAILS CLOSED: without
 * ANTHROPIC_API_KEY it returns an empty list, so the UI silently falls back to
 * manual hazard entry. No Anthropic SDK dependency is installed yet.
 *
 * TODO(sage): when enabling, add `@anthropic-ai/sdk`, call claude-sonnet-4-6 with
 * a cached OSHA/Cal-OSHA system prompt, request a JSON array of
 * { description, riskLevel, controlMeasure }, and parse defensively. See spec §13.
 */

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY

  // Read (and ignore for now) the body so the contract is stable.
  try {
    await req.json()
  } catch {
    /* ignore */
  }

  if (!key) {
    return Response.json({ hazards: [] })
  }

  // Inert until the SDK is wired (see TODO above). Returning [] keeps the PTP
  // working on manual entry even if the flag/key are set before implementation.
  return Response.json({ hazards: [] })
}
