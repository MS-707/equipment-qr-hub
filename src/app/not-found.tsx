import Link from 'next/link'
import { Search } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-mytra-bg flex items-center justify-center px-4">
      <div className="text-center">
        <Search className="w-12 h-12 text-fg-4 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-fg mb-2">Page not found</h1>
        <p className="text-fg-3 text-sm mb-6">
          The equipment or page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-mytra-purple hover:bg-mytra-purple/80
                     text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}
