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
  Brain,
  Cpu,
} from 'lucide-react'

const FEATURES = [
  { icon: MessageCircle, title: 'Sage AI Assistant', desc: 'On-device safety advisor with context from your PTPs, permits, and facility procedures.' },
  { icon: ListChecks, title: 'Job Hazard Analysis', desc: '5x5 risk matrix with before/after controls. Sage AI drafts steps for experiments, equipment, and deployments.' },
  { icon: Shield, title: 'Specialized Work Permits', desc: 'Laser, high-voltage, chemical, and confined space permits with live timers and safety checklists.' },
  { icon: ClipboardList, title: 'Pre-Task Plans', desc: 'Digital PTP with AI-suggested hazards, PPE requirements, and team sign-off before lab or field work.' },
  { icon: AlertTriangle, title: 'Incident Reporting', desc: 'Log near-misses and injuries with photos, witnesses, and root cause analysis — from the bench or the field.' },
  { icon: WifiOff, title: 'Offline-First', desc: 'Works without Wi-Fi at remote deployment sites. Syncs automatically when back in range.' },
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
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Hero */}
      <header className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#572DFF]/10 border border-[#572DFF]/20 text-[#572DFF] text-xs font-medium mb-6">
          <Shield className="w-3.5 h-3.5" />
          Early Access — Engineering Teams
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Build fast.
          <br />
          <span className="text-[#572DFF]">Work safe.</span>
        </h1>
        <p className="text-base sm:text-lg text-[#9A9A9A] max-w-xl mx-auto leading-relaxed">
          Sage EHS handles the safety documentation so your team stays focused on
          what they are building — not the paperwork required to build it.
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

      {/* Sage AI / Digital Twin spotlight */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-gradient-to-br from-[#572DFF]/5 to-[#141414] border border-[#572DFF]/20 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#572DFF]/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-[#572DFF]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Powered by a custom Anthropic agent</h3>
              <p className="text-xs text-[#9A9A9A]">Built on the Claude API with structured tool use</p>
            </div>
          </div>
          <p className="text-sm text-[#CCCCCC] leading-relaxed">
            Sage is not a chatbot bolted onto a form builder. It is a purpose-built AI agent
            that understands your facility, your active permits, and your operational context.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-[#572DFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Digital twin hazard identification</p>
                <p className="text-xs text-[#9A9A9A]">
                  Sage models your workspace and equipment to surface hazards before work begins —
                  factoring in active permits, recent incidents, and environmental conditions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-[#572DFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Intelligent triage</p>
                <p className="text-xs text-[#9A9A9A]">
                  New to the app? Sage reads the room — time of day, your role, what is open —
                  and guides you to the right form, the right permit, the right next step.
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
              <input type="text" maxLength={50} value={crewSize} onChange={(e) => setCrewSize(e.target.value)} placeholder="e.g. 8 engineers, 4 field ops" className={inputCls} />
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
