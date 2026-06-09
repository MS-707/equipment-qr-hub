'use client'

import { useState } from 'react'
import {
  Shield,
  ClipboardList,
  ListChecks,
  AlertTriangle,
  MessageCircle,
  Smartphone,
  WifiOff,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react'

const FEATURES = [
  { icon: ClipboardList, title: 'Pre-Task Plans', desc: 'Digital PTP with AI-suggested hazards, PPE tracking, and crew sign-on.' },
  { icon: ListChecks, title: 'Job Hazard Analysis', desc: '5x5 risk matrix with before/after controls. Sage AI drafts the steps.' },
  { icon: Shield, title: 'Work Permits', desc: 'Height, hot work, and confined space permits with live timers and checklists.' },
  { icon: AlertTriangle, title: 'Incident Reporting', desc: 'Near-miss and injury reports with photos, witnesses, and root cause analysis.' },
  { icon: MessageCircle, title: 'Sage AI Assistant', desc: 'On-device safety advisor that knows your PTPs, permits, and jobsite context.' },
  { icon: WifiOff, title: 'Offline-First', desc: 'Works without cell service. Syncs automatically when you are back online.' },
]

const ROLES = [
  'Superintendent',
  'Foreman / Lead',
  'Safety Manager / EHS',
  'Project Manager',
  'Field Worker',
  'Other',
]

const inputCls =
  'w-full bg-[#141414] border border-[#1F1F1F] rounded-lg py-2.5 px-3 text-sm text-white placeholder:text-[#666] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#572DFF]'

export default function BetaPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [crewSize, setCrewSize] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim() && email.trim() && company.trim() && role.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/beta/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, role, crewSize, reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error — check your connection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Hero */}
      <header className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#572DFF]/10 border border-[#572DFF]/20 text-[#572DFF] text-xs font-medium mb-6">
          <Shield className="w-3.5 h-3.5" />
          Beta Program — Limited Spots
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Construction safety,
          <br />
          <span className="text-[#572DFF]">built for the field.</span>
        </h1>
        <p className="text-base sm:text-lg text-[#9A9A9A] max-w-xl mx-auto leading-relaxed">
          Sage EHS replaces paper PTPs, permits, and incident reports with an AI-powered PWA
          that works offline, fits in your pocket, and keeps your crew compliant.
        </p>
      </header>

      {/* Feature grid */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 text-[#572DFF]" />
                <h3 className="text-sm font-semibold">{title}</h3>
              </div>
              <p className="text-xs text-[#9A9A9A] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Device mockup callout */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-6 flex items-center gap-4">
          <Smartphone className="w-10 h-10 text-[#572DFF] shrink-0" />
          <div>
            <h3 className="text-sm font-semibold mb-0.5">Install like a native app</h3>
            <p className="text-xs text-[#9A9A9A]">
              Sage is a Progressive Web App. Add it to your home screen on iPhone or iPad — no App Store needed.
              Works in airplane mode, syncs when you reconnect.
            </p>
          </div>
        </div>
      </section>

      {/* Signup form */}
      <section id="signup" className="max-w-xl mx-auto px-4 pb-20">
        {submitted ? (
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#34C172] mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">You're on the list</h2>
            <p className="text-sm text-[#9A9A9A]">
              We'll review your application and send next steps to <span className="text-white">{email}</span>.
              Most approvals go out within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-0.5">Request beta access</h2>
              <p className="text-xs text-[#9A9A9A]">
                We're onboarding crews in small batches. Fill this out and we'll get back to you fast.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9A9A9A] mb-1">Full name <span className="text-[#E66A6A]">*</span></label>
                <input type="text" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#9A9A9A] mb-1">Work email <span className="text-[#E66A6A]">*</span></label>
                <input type="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9A9A9A] mb-1">Company <span className="text-[#E66A6A]">*</span></label>
                <input type="text" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Construction" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-[#9A9A9A] mb-1">Your role <span className="text-[#E66A6A]">*</span></label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} ${!role ? 'text-[#666]' : ''}`}>
                  <option value="" disabled>Select role</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#9A9A9A] mb-1">Crew size (approximate)</label>
              <input type="text" maxLength={50} value={crewSize} onChange={(e) => setCrewSize(e.target.value)} placeholder="e.g. 12 field workers" className={inputCls} />
            </div>

            <div>
              <label className="block text-xs text-[#9A9A9A] mb-1">What are you hoping to solve?</label>
              <textarea rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Paper PTPs are a pain, compliance tracking is manual..." className={`${inputCls} resize-none`} />
            </div>

            {error && (
              <p className="text-xs text-[#E66A6A]">{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-colors
                         bg-[#572DFF] text-white hover:bg-[#6B42FF]
                         disabled:opacity-40 disabled:cursor-not-allowed
                         inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <>Request Access <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <p className="text-xs text-[#666] text-center">
              Your data stays on your device. We only use your email to send beta access instructions.
            </p>
          </form>
        )}
      </section>
    </div>
  )
}
