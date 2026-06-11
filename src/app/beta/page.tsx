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
  ArrowUpFromLine,
  Loader2,
  Lightbulb,
  PenLine,
  Flame,
  PackageOpen,
  Sparkles,
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
      <header className="relative">
        {/* Layered backdrop: blueprint grid fading out radially + breathing glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black_50%,transparent_100%)]" />
          <div className="absolute -top-48 left-1/2 w-[880px] h-[880px] rounded-full bg-[#572DFF]/[0.13] blur-3xl animate-glowPulse" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 pt-16 sm:pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#572DFF]/10 border border-[#572DFF]/25 text-[#A78BFF] text-xs font-medium mb-6 animate-blurIn">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#7C5CFF] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7C5CFF]" />
            </span>
            Early access — invites rolling out weekly
          </div>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5 animate-blurIn"
            style={{ animationDelay: '80ms' }}
          >
            Build right.
            <br />
            <span className="bg-gradient-to-br from-[#B9A3FF] via-[#7C5CFF] to-[#572DFF] bg-clip-text text-transparent">
              Start safe.
            </span>
          </h1>
          <p
            className="text-base sm:text-lg text-[#9A9A9A] max-w-xl mx-auto leading-relaxed mb-8 animate-blurIn"
            style={{ animationDelay: '160ms' }}
          >
            Safety documentation is how your team builds awareness before the work begins.
            Sage makes that process faster, sharper, and harder to get wrong.
          </p>
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-blurIn"
            style={{ animationDelay: '240ms' }}
          >
            <a
              href="#signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold
                         bg-[#572DFF] text-white hover:bg-[#6B42FF] transition-colors
                         shadow-[0_0_32px_-8px_rgba(87,45,255,0.6)] press-scale"
            >
              Request access <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium
                         border border-[#2E2E2E] text-[#C4C4C4] hover:border-[#572DFF]/40 hover:text-white
                         transition-colors press-scale"
            >
              Explore the toolkit
            </a>
          </div>
          <p className="text-xs text-[#666] mt-5 animate-blurIn" style={{ animationDelay: '300ms' }}>
            Built in-house · Works offline · No app store required
          </p>
        </div>

        {/* Product mockup with floating detail cards */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-10 pb-16">
          <div className="relative">
            {/* Browser frame, tilted back in perspective — levels out on hover */}
            <div
              aria-hidden
              className="relative animate-blurIn select-none rounded-xl p-px
                         bg-gradient-to-b from-[#3A3A3A] via-[#1F1F1F] to-[#1F1F1F]
                         shadow-[0_0_120px_-30px_rgba(87,45,255,0.55),0_30px_60px_-20px_rgba(0,0,0,0.7)]
                         md:[transform:perspective(1400px)_rotateX(5deg)]
                         md:hover:[transform:perspective(1400px)_rotateX(0deg)]
                         origin-top transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ animationDelay: '320ms' }}
            >
              <div className="rounded-[11px] bg-[#0A0A0A] overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center px-4 py-3 border-b border-[#1F1F1F] bg-[#0D0D0D]">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E66A6A]/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F0B53A]/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34C172]/60" />
                  </div>
                </div>

                {/* App nav */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#1F1F1F]">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-white">Sage</span>
                    <span className="text-[9px] font-semibold text-[#7C5CFF] tracking-wide">EHS</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 text-[10px] text-[#9A9A9A]">
                    <span className="relative text-white font-medium">
                      Home
                      <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#572DFF]" />
                    </span>
                    <span>Pre-Trip</span>
                    <span>Equipment</span>
                    <span>Work Orders</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-[#572DFF]/20 border border-[#572DFF]/30 flex items-center justify-center text-[8px] font-semibold text-[#A78BFF]">
                    MS
                  </div>
                </div>

                {/* Dashboard body */}
                <div className="px-5 py-5 space-y-4">
                  <div className="flex items-end justify-between">
                    <p className="text-base font-bold text-white">Hello, Mark</p>
                    <p className="text-[10px] text-[#9A9A9A]">Thursday, June 11</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: "Today's PTP", value: 'Logged', sub: '5 signed', cls: 'text-[#34C172]' },
                      { label: 'Active permits', value: '2', sub: 'open now', cls: 'text-white' },
                      { label: 'Incidents', value: '0', sub: 'last 7 days', cls: 'text-white' },
                    ].map(({ label, value, sub, cls }) => (
                      <div key={label} className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
                        <p className="text-[8px] uppercase tracking-[0.12em] text-[#9A9A9A]">{label}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${cls}`}>{value}</p>
                        <p className="text-[8px] text-[#666]">{sub}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-[#9A9A9A] font-semibold">
                        Quick actions
                      </p>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2E2E2E] to-transparent" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: ClipboardList, label: 'Start PTP', primary: true },
                        { icon: ListChecks, label: 'Job Hazard Analysis' },
                        { icon: ArrowUpFromLine, label: 'Work-at-Height' },
                        { icon: Flame, label: 'Hot Work' },
                        { icon: PackageOpen, label: 'Confined Space' },
                        { icon: AlertTriangle, label: 'Report Incident' },
                      ].map(({ icon: Icon, label, primary }) => (
                        <div
                          key={label}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-medium border ${
                            primary
                              ? 'bg-[#572DFF] border-[#572DFF] text-white'
                              : 'bg-[#141414] border-[#1F1F1F] text-[#C4C4C4]'
                          }`}
                        >
                          <Icon className="w-3 h-3 shrink-0" />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-[#9A9A9A] font-semibold">
                        Recent activity
                      </p>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2E2E2E] to-transparent" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-[#141414] border border-[#1F1F1F] rounded-md px-3 py-2.5">
                        <div>
                          <p className="text-[8px] font-mono text-[#9A9A9A]">PTP-0118</p>
                          <p className="text-[10px] text-white">Conveyor drive install — Line 3</p>
                        </div>
                        <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-[#34C172]/10 text-[#34C172]">
                          Approved
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-[#141414] border border-[#1F1F1F] rounded-md px-3 py-2.5">
                        <div>
                          <p className="text-[8px] font-mono text-[#9A9A9A]">HW-0042</p>
                          <p className="text-[10px] text-white">Bracket welds — Bay 4 mezzanine</p>
                        </div>
                        <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-[#F0B53A]/10 text-[#F0B53A]">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom fade — mockup melts into the page */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -bottom-1 h-32 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/75 to-transparent"
            />

            {/* Floating satellites — absolutely positioned on md+, scroll row on mobile */}

            {/* Desktop: absolute floaters */}
            <div
              aria-hidden
              className="hidden md:block absolute -right-8 lg:-right-20 top-12 z-10 animate-blurIn"
              style={{ animationDelay: '600ms' }}
            >
              <div className="animate-float w-60 rotate-2 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#7C5CFF]" />
                  <p className="text-[10px] font-semibold text-white">Sage suggests</p>
                </div>
                <p className="text-[10px] text-[#C4C4C4] leading-relaxed mb-2.5">
                  Pinch points during conveyor alignment — add lockout verification and cut-resistant gloves.
                </p>
                <div className="flex items-center gap-1.5 text-[9px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-[#E66A6A]/10 text-[#E66A6A]">Risk 16</span>
                  <ArrowRight className="w-2.5 h-2.5 text-[#666]" />
                  <span className="px-1.5 py-0.5 rounded bg-[#34C172]/10 text-[#34C172]">Risk 4</span>
                </div>
              </div>
            </div>

            <div
              aria-hidden
              className="hidden md:block absolute -left-8 lg:-left-20 top-48 z-10 animate-blurIn"
              style={{ animationDelay: '700ms' }}
            >
              <div
                className="animate-floatSlow w-52 -rotate-2 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                style={{ animationDelay: '1.5s' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[#F2934A]" />
                    <p className="text-[10px] font-semibold text-white">Hot Work</p>
                  </div>
                  <span className="flex items-center gap-1 text-[9px] text-[#34C172]">
                    <span className="w-1 h-1 rounded-full bg-[#34C172] animate-pulse" />
                    Active
                  </span>
                </div>
                <p className="text-[9px] font-mono text-[#9A9A9A] mb-1">HW-0042 · Bay 4 mezzanine</p>
                <p className="text-sm font-mono font-semibold text-white tracking-tight">
                  02:14:36{' '}
                  <span className="text-[9px] text-[#9A9A9A] font-sans font-normal">remaining</span>
                </p>
              </div>
            </div>

            <div
              aria-hidden
              className="hidden lg:block absolute -right-12 bottom-28 z-10 animate-blurIn"
              style={{ animationDelay: '800ms' }}
            >
              <div
                className="animate-float w-56 rotate-1 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-center gap-2.5"
                style={{ animationDelay: '3s' }}
              >
                <CheckCircle2 className="w-4 h-4 text-[#34C172] shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-white">PTP approved</p>
                  <p className="text-[9px] text-[#9A9A9A]">Reviewed by EHS · just now</p>
                </div>
              </div>
            </div>

            {/* Mobile: horizontal scroll row beneath mockup */}
            <div className="md:hidden relative z-10 -mt-10 pb-2">
              <div className="flex gap-3 overflow-x-auto scrollbar-hide px-1 py-3 snap-x snap-mandatory">
                <div
                  className="snap-center shrink-0 w-64 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)] animate-blurIn"
                  style={{ animationDelay: '500ms' }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#7C5CFF]" />
                    <p className="text-[10px] font-semibold text-white">Sage suggests</p>
                  </div>
                  <p className="text-[10px] text-[#C4C4C4] leading-relaxed mb-2.5">
                    Pinch points during conveyor alignment — add lockout verification and cut-resistant gloves.
                  </p>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-[#E66A6A]/10 text-[#E66A6A]">Risk 16</span>
                    <ArrowRight className="w-2.5 h-2.5 text-[#666]" />
                    <span className="px-1.5 py-0.5 rounded bg-[#34C172]/10 text-[#34C172]">Risk 4</span>
                  </div>
                </div>

                <div
                  className="snap-center shrink-0 w-56 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)] animate-blurIn"
                  style={{ animationDelay: '600ms' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-[#F2934A]" />
                      <p className="text-[10px] font-semibold text-white">Hot Work</p>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] text-[#34C172]">
                      <span className="w-1 h-1 rounded-full bg-[#34C172] animate-pulse" />
                      Active
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-[#9A9A9A] mb-1">HW-0042 · Bay 4 mezzanine</p>
                  <p className="text-sm font-mono font-semibold text-white tracking-tight">
                    02:14:36{' '}
                    <span className="text-[9px] text-[#9A9A9A] font-sans font-normal">remaining</span>
                  </p>
                </div>

                <div
                  className="snap-center shrink-0 w-56 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex items-center gap-2.5 animate-blurIn"
                  style={{ animationDelay: '700ms' }}
                >
                  <CheckCircle2 className="w-4 h-4 text-[#34C172] shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-white">PTP approved</p>
                    <p className="text-[9px] text-[#9A9A9A]">Reviewed by EHS · just now</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Feature grid */}
      <section id="features" className="max-w-3xl mx-auto px-4 pb-12 scroll-mt-12">
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
              <h2 className="text-lg font-semibold mb-0.5">Join the beta</h2>
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
