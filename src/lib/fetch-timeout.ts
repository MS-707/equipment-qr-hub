/**
 * Hard deadlines for OUTBOUND third-party calls. Serverless handlers must
 * never hang on a wedged upstream: a timed-out call throws (TimeoutError
 * DOMException from AbortSignal.timeout), which each call site's existing
 * catch path maps to its degraded 'failed'/502/best-effort response.
 *
 * - fetchWithTimeout: raw fetch to Notion / Resend / Slack. Callers may pass
 *   their own signal in init to override.
 * - ANTHROPIC_TIMEOUT_MS: passed as the Anthropic SDK client `timeout`
 *   option; the SDK enforces it per request via AbortSignal.timeout
 *   internally (and re-arms it across its own retries, which a shared
 *   per-client signal would not).
 */

export const EXTERNAL_FETCH_TIMEOUT_MS = 10_000
export const ANTHROPIC_TIMEOUT_MS = 60_000

export function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = EXTERNAL_FETCH_TIMEOUT_MS
): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) })
}
