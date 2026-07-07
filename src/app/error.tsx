'use client'

import { AlertTriangle } from 'lucide-react'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main id="main" className="min-h-screen bg-mytra-bg flex items-center justify-center px-4">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-warn mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-fg mb-2">Something went wrong</h1>
        <p className="text-fg-3 text-sm mb-6">
          An unexpected error occurred. Try refreshing the page.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-mytra-purple hover:bg-mytra-purple/80
                     text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </main>
  )
}
