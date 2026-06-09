'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X, Send, Loader2, WifiOff } from 'lucide-react'
import { getCurrentIdentity } from '@/lib/identity'
import { buildSageContext, contextToPrompt } from '@/lib/sage-context'
import { matchFaq } from '@/lib/sage-faq'

const SAGE_ENABLED = process.env.NEXT_PUBLIC_AI_ASSIST === '1'
const HISTORY_KEY = 'sage-triage-history'
const TS_KEY = 'sage-triage-ts'
const SEEN_KEY = 'sage-fab-seen'
const LAUNCH_KEY = 'sage-fab-launches'
const MAX_HINT_LAUNCHES = 3
const IDLE_MS = 15 * 60 * 1000
const FAB_Y_KEY = 'sage-fab-y'

/** Keep the draggable FAB clear of the header (top) and bottom tab bar (bottom). */
function clampFabTop(y: number): number {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return Math.max(72, Math.min(y, vh - 96))
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_CHIPS = [
  { label: 'Review my PTP', q: 'Can you review my Pre-Task Plan for today and flag anything missing?' },
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
  try {
    const trimmed = msgs.slice(-10)
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
    sessionStorage.setItem(TS_KEY, String(Date.now()))
  } catch { /* private browsing or full storage */ }
}

export default function SageTriage() {
  if (!SAGE_ENABLED) return null

  return <SageTriageInner />
}

function SageTriageInner() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [followUps, setFollowUps] = useState<string[]>([])
  const [showPulse, setShowPulse] = useState(false)
  const [online, setOnline] = useState(true)
  const [fabTop, setFabTop] = useState<number | null>(null)
  const [tourHidden, setTourHidden] = useState(false)

  useEffect(() => {
    const hide = () => setTourHidden(true)
    const show = () => setTourHidden(false)
    window.addEventListener('sage:tour-active', hide)
    window.addEventListener('sage:tour-ended', show)
    return () => {
      window.removeEventListener('sage:tour-active', hide)
      window.removeEventListener('sage:tour-ended', show)
    }
  }, [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startY: number; startTop: number; moved: boolean; lastTop: number } | null>(null)
  const justDraggedRef = useRef(false)
  const messagesRef = useRef<ChatMessage[]>(messages)
  messagesRef.current = messages

  useEffect(() => {
    setMessages(loadHistory())
    // Show the discovery hint for the first few app launches until Sage is opened.
    if (!localStorage.getItem(SEEN_KEY)) {
      const launches = Number(localStorage.getItem(LAUNCH_KEY) || '0')
      if (launches < MAX_HINT_LAUNCHES) {
        setShowPulse(true)
        localStorage.setItem(LAUNCH_KEY, String(launches + 1))
      }
    }
    setOnline(navigator.onLine)
    // Restore the FAB's vertical position, or default to near the bottom.
    const storedY = Number(localStorage.getItem(FAB_Y_KEY))
    setFabTop(Number.isFinite(storedY) && storedY > 0 ? clampFabTop(storedY) : clampFabTop(window.innerHeight - 160))
    const goOn = () => setOnline(true)
    const goOff = () => setOnline(false)
    const reclamp = () => setFabTop((t) => (t == null ? t : clampFabTop(t)))
    window.addEventListener('online', goOn)
    window.addEventListener('offline', goOff)
    window.addEventListener('resize', reclamp)
    return () => {
      window.removeEventListener('online', goOn)
      window.removeEventListener('offline', goOff)
      window.removeEventListener('resize', reclamp)
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
    if (justDraggedRef.current) return // ignore the click that ends a drag
    setOpen(true)
    if (showPulse) {
      setShowPulse(false)
      localStorage.setItem(SEEN_KEY, '1')
    }
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Tap-hold and slide the FAB up/down the right edge to move it clear of content.
  function onFabPointerDown(e: React.PointerEvent) {
    if (fabTop == null) return
    dragRef.current = { startY: e.clientY, startTop: fabTop, moved: false, lastTop: fabTop }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onFabPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const dy = e.clientY - d.startY
    if (Math.abs(dy) > 6) d.moved = true
    if (d.moved) {
      const t = clampFabTop(d.startTop + dy)
      d.lastTop = t
      setFabTop(t)
    }
  }
  function onFabPointerUp(e: React.PointerEvent) {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (d.moved) {
      justDraggedRef.current = true
      try { localStorage.setItem(FAB_Y_KEY, String(Math.round(d.lastTop))) } catch { /* non-fatal */ }
      // Clear on next tick so the synthetic click fired after pointerup is suppressed.
      setTimeout(() => { justDraggedRef.current = false }, 0)
    }
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setFollowUps([])

    if (!online) {
      const faqAnswer = matchFaq(trimmed)
      const reply: ChatMessage = {
        role: 'assistant',
        content: faqAnswer ?? "I'm offline right now. For emergencies, call 911. You can still use the app offline — the bottom tabs (Home, Pre-Trip, Assets, Orders) all work without a connection.",
      }
      setMessages(prev => {
        const updated = [...prev, reply]
        saveHistory(updated)
        return updated
      })
      setFollowUps(faqAnswer ? ['Start a PTP', 'What PPE do I need?', 'Report an incident'] : [])
      setLoading(false)
      return
    }

    try {
      const identity = getCurrentIdentity()
      const ctx = buildSageContext(pathname, identity?.name ?? null)
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 28000)

      const res = await fetch('/api/sage/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          context: contextToPrompt(ctx),
          history: messagesRef.current.slice(-10),
          localHour: new Date().getHours(),
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      const data = await res.json()
      let replyText = data.reply
      let suggestions: string[] = []
      if (!res.ok || !replyText) {
        const faqAnswer = matchFaq(trimmed)
        replyText = faqAnswer ?? 'Sorry, I couldn\'t process that right now. Try again or check the FAQ chips above.'
      } else {
        suggestions = Array.isArray(data.followUps) ? data.followUps.slice(0, 3) : []
      }
      const reply: ChatMessage = {
        role: 'assistant',
        content: replyText,
      }
      setMessages(prev => {
        const updated = [...prev, reply]
        saveHistory(updated)
        return updated
      })
      setFollowUps(suggestions)
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      const reply: ChatMessage = {
        role: 'assistant',
        content: isTimeout
          ? 'Request timed out — try a shorter question.'
          : 'Network error — check your connection and try again.',
      }
      setMessages(prev => {
        const updated = [...prev, reply]
        saveHistory(updated)
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [loading, online, pathname])

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
      {/* FAB — draggable vertically along the right edge */}
      {!open && (
        <div
          data-tour="sage-fab"
          className={`no-print fixed right-4 z-[41] flex items-center gap-2 transition-opacity duration-200 ${fabTop == null ? 'bottom-20 sm:bottom-6' : ''} ${tourHidden ? 'opacity-0 pointer-events-none' : ''}`}
          style={fabTop == null ? undefined : { top: fabTop }}
        >
          {showPulse && (
            <button
              onClick={handleOpen}
              className="animate-fadeIn bg-mytra-card border border-mytra-border text-fg
                         text-xs font-medium px-3 py-2 rounded-full shadow-pop min-h-[44px]
                         hover:bg-mytra-card-hover transition-colors"
            >
              Ask Sage
            </button>
          )}
          <button
            onClick={handleOpen}
            onPointerDown={onFabPointerDown}
            onPointerMove={onFabPointerMove}
            onPointerUp={onFabPointerUp}
            aria-label="Open safety assistant (drag to move)"
            className={`w-12 h-12 rounded-full touch-none select-none cursor-grab active:cursor-grabbing
                       bg-mytra-purple text-white shadow-pop flex items-center justify-center
                       hover:bg-mytra-purple-hover transition-colors
                       ${showPulse ? 'animate-pulse' : ''}`}
          >
            <MessageCircle className="w-5 h-5 pointer-events-none" />
          </button>
        </div>
      )}

      {/* Chat dialog */}
      <dialog
        ref={dialogRef}
        onCancel={(e) => { e.preventDefault(); setOpen(false) }}
        className="backdrop:bg-black/50 bg-transparent p-0 m-0
                   fixed inset-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-auto sm:left-auto
                   w-full sm:w-[360px] h-full sm:h-[min(600px,85vh)]
                   max-w-full max-h-full
                   outline-none animate-fadeIn"
      >
        <div className="flex flex-col h-full sm:rounded-2xl overflow-hidden
                        bg-mytra-card border border-mytra-border shadow-pop
                        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-mytra-border shrink-0">
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" role="log" aria-live="polite">
            {/* Greeting */}
            <div className="flex gap-2">
              <span className="w-6 h-6 rounded-full bg-mytra-purple flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
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
                  <span className="w-6 h-6 rounded-full bg-mytra-purple flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
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

            {/* Follow-up suggestion chips */}
            {followUps.length > 0 && !loading && (
              <div className="flex flex-wrap gap-1.5 pl-8 animate-fadeIn">
                {followUps.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full border border-mytra-purple/30
                               text-mytra-purple hover:bg-mytra-purple/10 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2">
                <span className="w-6 h-6 rounded-full bg-mytra-purple flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  S
                </span>
                <div className="bg-mytra-card-hover rounded-lg rounded-tl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-fg-3" />
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer + Input */}
          <div className="px-3 pt-1.5 shrink-0">
            <p className="text-center text-xs text-fg-4 leading-tight">
              Sage is an AI assistant, not a substitute for a competent safety professional.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-mytra-border flex gap-2 shrink-0 mt-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Sage a question..."
              disabled={loading}
              maxLength={500}
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
