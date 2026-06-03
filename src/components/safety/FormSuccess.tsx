'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

interface FormSuccessProps {
  id: string
  title: string
  message: string
  onNew: () => void
  newLabel?: string
}

export default function FormSuccess({ id, title, message, onNew, newLabel = 'New' }: FormSuccessProps) {
  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-green-400 mb-1">{title}</h3>
        <p className="text-sm text-green-300/80">
          {message} <span className="font-mono text-white">{id}</span>.
        </p>
      </div>
      <Link
        href={`/safety/record/${id}`}
        className="block w-full text-center py-3 rounded-lg text-sm font-semibold bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors"
      >
        View / Print
      </Link>
      <button
        type="button"
        onClick={onNew}
        className="w-full py-3 rounded-lg text-sm font-semibold bg-mytra-card border border-mytra-border text-white hover:bg-mytra-card-hover transition-colors"
      >
        {newLabel}
      </button>
      <Link href="/safety" className="block text-center text-sm text-gray-400 hover:text-white">
        Back to Safety Hub
      </Link>
    </div>
  )
}
