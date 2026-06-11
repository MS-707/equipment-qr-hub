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
  Lightbulb,
  PenLine,
} from 'lucide-react'

const FEATURES = [
  { icon: ClipboardList, title: 'Pre-Task Plans', desc: 'Digital PTP with suggested hazards, recommended PPE, and team sign-off before work starts.' },
  { icon: Shield, title: 'Work Permits', desc: 'Work-at-height, hot work, and confined-space permits with checklists that gate issuance and live expiry countdowns.' },
  { icon: AlertTriangle, title: 'Incident Reporting', desc: 'Log near-misses and injuries with photos, witnesses, and root-cause notes — from the bench or the field.' },
  { icon: WifiOff, title: 'Offline-First', desc: 'Works without Wi-Fi at remote sites. Records save to your device and sync automatically when you reconnect.' },
  { icon: ListChecks, title: 'Job Hazard Analysis', desc: '5×5 risk matrix with before- and after-control ratings. Sage drafts hazards and controls for each step you enter.' },
  { icon: MessageCircle, title: 'Sage Assistant', desc: 'Context-aware help that reads today’s plan, your open permits, and recent incidents. Works offline with a built-in safety FAQ.' },
]

const ROLES = [
  'Lab Manager',
  'EHS / Safety Manager',
  'Research Engineer',
  'Systems / Robotics Engineer',
  'Operations Manager',
  'Facilities Manager',
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
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      {/* Hero */}
      <header className="relative max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-[#572DFF]/[0.08] blur-3xl"
        />
        <div className="relative inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#572DFF]/10 border border-[#572DFF]/20 text-[#572DFF] text-xs font-medium mb-6 animate-blurIn">
          <Shield className="w-3.5 h-3.5" />
          Early Access
        </div>
        <h1 className="relative text-3xl sm:text-4xl font-bold tracking-tight mb-4 animate-blurIn" style={{ animationDelay: '80ms' }}>
          Build right.
          <br />
          <span className="text-[#572DFF]">Start safe.</span>
        </h1>
        <p
          className="relative text-base sm:text-lg text-[#9A9A9A] max-w-xl mx-auto leading-relaxed animate-blurIn"
          style={{ animationDelay: '160ms' }}
        >
          Safety documentation is how your team builds awareness before the work begins.
          Sage makes that process faster, sharper, and harder to get wrong.
        </p>
      </header>

      {/* Feature grid */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              style={{ animationDelay: `${200 + i * 60}ms` }}
              className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-4 animate-blurIn
                         transition-colors duration-200 hover:border-[#572DFF]/30"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 text-[#572DFF]" />
                <h3 className="text-sm font-semibold">{title}</h3>
              </div>
              <p className="text-xs text-[#9A9A9A] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div aria-hidden className="hairline max-w-3xl mx-auto mb-12" />

      {/* Roadmap */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="border border-dashed border-[#1F1F1F] rounded-lg p-4">
          <p className="text-xs font-semibold text-[#9A9A9A] mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#572DFF]" />
            On the roadmap
          </p>
          <p className="text-xs text-[#9A9A9A] leading-relaxed">
            Custom safety knowledge base — upload your SOPs, policies, and site procedures so Sage answers from your rules, not just general guidance · Laser, high-voltage, and chemical work permits · photo &amp; signature sync · role-aware guidance
          </p>
        </div>
      </section>

      {/* Mindfulness / ease-of-use spotlight */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-gradient-to-br from-[#572DFF]/5 to-[#141414] border border-[#572DFF]/20 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#572DFF]/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-[#572DFF]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Built to build awareness</h3>
              <p className="text-xs text-[#9A9A9A]">Quick to complete, hard to get wrong</p>
            </div>
          </div>
          <p className="text-sm text-[#CCCCCC] leading-relaxed">
            Safety documentation only works when people actually engage with it. Sage makes
            pre-task plans, permits, and hazard analyses fast enough to do every time — and
            structured enough that completing one walks your team through the risks before
            the work starts.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5">
              <PenLine className="w-4 h-4 text-[#572DFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">A draft, not a blank page</p>
                <p className="text-xs text-[#9A9A9A]">
                  Describe the work and Sage suggests the likely hazards, risk ratings, and
                  control measures — so your team starts by sharpening a draft instead of
                  staring at empty fields.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-[#572DFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Help in context</p>
                <p className="text-xs text-[#9A9A9A]">
                  Stuck mid-task? The Sage assistant reads today’s plan, your open permits, and
                  recent incidents, and points you to the right form or permit. Works offline, too.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Device mockup callout */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-6 flex items-center gap-4">
          <Smartphone className="w-10 h-10 text-[#572DFF] shrink-0" />
          <div>
            <h3 className="text-sm font-semibold mb-0.5">Install like a native app</h3>
            <p className="text-xs text-[#9A9A9A]">
              Sage is a Progressive Web App. Add it to your home screen — no App Store needed.
              Works offline at remote sites, syncs when you reconnect.
            </p>
          </div>
        </div>
      </section>

      <div aria-hidden className="hairline max-w-3xl mx-auto mb-12" />

      {/* Signup form */}
      <section id="signup" className="max-w-xl mx-auto px-4 pb-20">
        {submitted ? (
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#34C172] mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">You are on the list</h2>
            <p className="text-sm text-[#9A9A9A]">
              We will review your submission and send next steps to <span className="text-white">{email}</span>.
              Most invites go out within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-0.5">Join the Sage EHS beta</h2>
              <p className="text-xs text-[#9A9A9A]">
                We are rolling out access in small cohorts. Tell us about your team and we will be in touch shortly.
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
                <input type="text" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Robotics" className={inputCls} />
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
              <label className="block text-xs text-[#9A9A9A] mb-1">Team size (approximate)</label>
              <input type="text" maxLength={50} value={crewSize} onChange={(e) => setCrewSize(e.target.value)} placeholder="e.g. 8 engineers, 4 lab technicians" className={inputCls} />
            </div>

            <div>
              <label className="block text-xs text-[#9A9A9A] mb-1">What are you hoping to solve?</label>
              <textarea rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Safety docs slow us down, hazard tracking is manual, need better permit workflows..." className={`${inputCls} resize-none`} />
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
