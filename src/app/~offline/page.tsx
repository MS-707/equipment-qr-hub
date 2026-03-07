import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-mytra-bg flex items-center justify-center px-4">
      <div className="text-center">
        <WifiOff className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">You are offline</h1>
        <p className="text-gray-400 text-sm mb-6">
          This page hasn&apos;t been cached yet. Connect to the network and try again.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-mytra-purple hover:bg-mytra-purple/80
                     text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Back to Directory
        </Link>
      </div>
    </main>
  )
}
