import { AlertTriangle, ArrowLeft } from 'lucide-react'
import Link from '../shims/next-link'

/**
 * Terminal view for anything the slice router does not serve. The full
 * 23-route table lands in KIN-M2; until then a deep link into an unported
 * route arrives here rather than at a blank screen.
 */
export default function NotFound({ path, message }: { path: string; message?: string }) {
  return (
    <main id="main" className="min-h-screen bg-mytra-bg">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-card border border-mytra-border bg-mytra-card px-5 py-6">
          <AlertTriangle className="w-6 h-6 text-warn mb-3" aria-hidden="true" />
          <h1 className="text-lg font-bold text-fg">Page not found</h1>
          <p className="mt-2 text-sm text-fg-3">
            {message ?? 'This route is not part of the pre-trip slice yet.'}
          </p>
          <p className="mt-1 font-mono text-xs text-fg-4 break-all">{path}</p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold
                       bg-mytra-purple/10 border border-mytra-purple/30 text-mytra-purple
                       hover:bg-mytra-purple/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to equipment</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
