'use client'

import Link from 'next/link'
import { CheckCircle2, WifiOff } from 'lucide-react'

interface FormSuccessProps {
  id: string
  title: string
  message: string
  onNew: () => void
  newLabel?: string
  offline?: boolean
}

export default function FormSuccess({ id, title, message, onNew, newLabel = 'New', offline }: FormSuccessProps) {
  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-ok/10 border border-ok/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-ok mb-1">{title}</h3>
        <p className="text-sm text-ok">
          {message} <span className="font-mono text-fg">{id}</span>.
        </p>
      </div>
      {offline && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5">
          <WifiOff className="w-4 h-4 text-warn shrink-0" />
          <p className="text-xs text-warn">Saved locally. Will sync automatically when connection returns.</p>
        </div>
      )}
      <Link
        href={`/safety/record/${id}`}
        className="block w-full text-center py-3 rounded-lg text-sm font-semibold bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors"
      >
        View / Print
      </Link>
      <button
        type="button"
        onClick={onNew}
        className="w-full py-3 rounded-lg text-sm font-semibold bg-mytra-card border border-mytra-border text-fg hover:bg-mytra-card-hover transition-colors"
      >
        {newLabel}
      </button>
      <Link href="/safety" className="block text-center text-sm text-fg-2 hover:text-fg">
        Back to Safety Hub
      </Link>
    </div>
  )
}
