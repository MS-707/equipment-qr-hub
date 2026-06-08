'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, WifiOff } from 'lucide-react'
import { getCurrentIdentity } from '@/lib/identity'
import { matchFaq } from '@/lib/sage-faq'

const SAGE_ENABLED = process.env.NEXT_PUBLIC_AI_ASSIST === '1'
const HISTORY_KEY = 'sage-triage-history'
const TS_KEY = 'sage-triage-ts'
const SEEN_KEY = 'sage-fab-seen'
const IDLE_MS = 15 * 60 * 1000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_CHIPS = [
  { label: 'Start PTP', q: 'How do I start a Pre-Task Plan?' },
  { label: 'Report incident', q: 'I need to report a safety incident' },
  { label: 'Active permits', q: 'What permits are currently active?' },
  { label: 'PPE help', q: 'What PPE do I need for this task?' },
]

function loadHistory(): ChatMessage[] {
  try {
    const ts = sessionStorage.getItem(TS_KEY)
    if (ts && Date.now() - Number(ts) > IDLE_MS) {
      sessionStorage.removeItem(HISTORY_KEY)
      sessionStorage.removeItem(TS_KEY)
      return []
    }
    const raw = sessionStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(msgs: ChatMessage[]) {
  const trimmed = msgs.slice(-10)
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
  sessionStorage.setItem(TS_KEY, String(Date.now()))
}

export default function SageTriage() {
  if (!SAGE_ENABLED) return null

  return <SageTriageInner />
}

function SageTriageInner() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPulse, setShowPulse] = useState(false)
  const [online, setOnline] = useState(true)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMessages(loadHistory())
    setShowPulse(!localStorage.getItem(SEEN_KEY))
    setOnline(navigator.onLine)
    const goOn = () => setOnline(true)
    const goOff = () => setOnline(false)
    window.addEventListener('online', goOn)
    window.addEventListener('offline', goOff)
    return () => {
      window.removeEventListener('online', goOn)
      window.removeEventListener('offline', goOff)
    }
  }, [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  function handleOpen() {
    setOpen(true)
    if (showPulse) {
      setShowPulse(false)
      localStorage.setItem(SEEN_KEY, '1')
    }
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    if (!online) {
      const faqAnswer = matchFaq(trimmed)
      const reply: ChatMessage = {
        role: 'assistant',
        content: faqAnswer ?? "I'm offline right now. For emergencies, call 911. You can navigate the app using the bottom tabs — Safety, Work Orders, and Equipment Directory are all available offline.",
      }
      const updated = [...next, reply]
      setMessages(updated)
      saveHistory(updated)
      setLoading(false)
      return
    }

    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 28000)

      const res = await fetch('/api/sage/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-10),
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      const data = await res.json()
      const reply: ChatMessage = {
        role: 'assistant',
        content: data.reply || data.error || 'Sorry, I couldn\'t process that. Try again.',
      }
      const updated = [...next, reply]
      setMessages(updated)
      saveHistory(updated)
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      const reply: ChatMessage = {
        role: 'assistant',
        content: isTimeout
          ? 'Request timed out — try a shorter question.'
          : 'Network error — check your connection and try again.',
      }
      const updated = [...next, reply]
      setMessages(updated)
      saveHistory(updated)
    } finally {
      setLoading(false)
    }
  }, [messages, loading, online])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  const identity = getCurrentIdentity()
  const greeting = identity?.name
    ? `Hi ${identity.name.split(' ')[0]}. What can I help you with?`
    : 'Hi there. What can I help you with?'

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={handleOpen}
          aria-label="Open safety assistant"
          className={`no-print fixed bottom-20 right-4 sm:bottom-6 z-[41] w-12 h-12 rounded-full
                     bg-mytra-purple text-white shadow-pop flex items-center justify-center
                     hover:bg-mytra-purple-hover active:scale-95 transition-all
                     ${showPulse ? 'animate-pulse' : ''}`}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {/* Chat dialog */}
      <dialog
        ref={dialogRef}
        onCancel={(e) => { e.preventDefault(); setOpen(false) }}
        className="backdrop:bg-black/50 bg-transparent p-0 m-0
                   fixed inset-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-auto sm:left-auto
                   w-full sm:w-[360px] h-full sm:h-[min(600px,85vh)]
                   outline-none animate-fadeIn"
      >
        <div className="flex flex-col h-full sm:rounded-2xl overflow-hidden
                        bg-mytra-card border border-mytra-border shadow-pop">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-mytra-border">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-mytra-purple flex items-center justify-center text-white text-xs font-bold">
                S
              </span>
              <span className="text-sm font-semibold text-fg">Sage</span>
              {!online && (
                <span className="inline-flex items-center gap-1 text-xs text-warn">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-lg
                         text-fg-3 hover:text-fg hover:bg-mytra-card-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" role="log">
            {/* Greeting */}
            <div className="flex gap-2">
              <span className="w-6 h-6 rounded-full bg-mytra-purple flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">
                S
              </span>
              <div className="bg-mytra-card-hover rounded-lg rounded-tl-sm px-3 py-2 text-sm text-fg max-w-[85%]">
                {greeting}
              </div>
            </div>

            {/* Quick chips when no history */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 pl-8">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => sendMessage(chip.q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-mytra-purple/30
                               text-mytra-purple hover:bg-mytra-purple/10 transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <span className="w-6 h-6 rounded-full bg-mytra-purple flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">
                    S
                  </span>
                )}
                <div
                  className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-mytra-purple text-white rounded-tr-sm'
                      : 'bg-mytra-card-hover text-fg rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2">
                <span className="w-6 h-6 rounded-full bg-mytra-purple flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">
                  S
                </span>
                <div className="bg-mytra-card-hover rounded-lg rounded-tl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-fg-3" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-mytra-border flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Sage a question..."
              disabled={loading}
              inputMode="text"
              enterKeyHint="send"
              className="flex-1 bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                         text-sm text-fg placeholder:text-fg-4 min-h-[44px]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple
                         disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="w-11 h-11 flex items-center justify-center rounded-lg
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </dialog>
    </>
  )
}
