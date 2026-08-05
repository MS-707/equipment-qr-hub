import { ArrowLeft, Construction } from 'lucide-react'
import { navigate } from '../navigation'

/**
 * Landing for routes the ported screens link to but the slice does not carry.
 *
 * Two prominent CTAs inside the unchanged components point off the slice:
 * InspectLanding's "Full equipment profile" (/equipment/:id) and the
 * post-submit "View / print signed record" (/inspections/record/:id). Both are
 * real buttons a worker will tap. Sending them to the generic not-found reads
 * as "the app is broken"; this says what actually happened and keeps the
 * inspection they just completed from feeling lost.
 *
 * Deleted when KIN-M2 ports those routes for real.
 */
export default function NotPortedYet({ what, path }: { what: string; path: string }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10">
      <div className="rounded-card border border-mytra-border bg-mytra-surface p-6">
        <Construction className="mb-3 h-6 w-6 text-fg-3" aria-hidden="true" />
        <h1 className="mb-2 text-xl font-bold text-fg">{what} isn&rsquo;t in this preview yet</h1>
        <p className="mb-1 text-sm text-fg-2">
          Your inspection was saved. This screen is part of the next stage of the port and
          will appear here once the full app lands.
        </p>
        <p className="mb-5 font-mono text-xs text-fg-3">{path}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-mytra-purple px-4 text-white transition-colors hover:bg-mytra-purple-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to equipment
        </button>
      </div>
    </main>
  )
}
