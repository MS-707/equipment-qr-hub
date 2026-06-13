'use client'

import { useEffect, useState } from 'react'
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
  FlaskConical,
  FileSearch,
} from 'lucide-react'

const FEATURES = [
  { icon: ClipboardList, title: 'Pre-Task Plans', desc: 'Describe the job and Sage drafts the hazards, PPE, and controls. Your crew reviews and signs on in minutes — not the night before.' },
  { icon: ListChecks, title: 'Job Hazard Analysis', desc: 'AI drafts a full 5×5 risk matrix for every step you enter. Your team sharpens the assessment instead of starting from scratch.' },
  { icon: Shield, title: 'Work Permits', desc: 'Hot work, height, and confined-space permits that cannot be issued until every checklist item is cleared. Live countdowns track expiry so nothing lapses.' },
  { icon: FlaskConical, title: 'SDS Binder', desc: 'Searchable safety data sheet library at every job site. Look up handling, storage, and first aid for any chemical — even offline.' },
  { icon: WifiOff, title: 'Offline-First', desc: 'No Wi-Fi on the job site? No problem. Everything saves to your device and syncs the moment you are back online.' },
  { icon: AlertTriangle, title: 'Incident Reporting', desc: 'Log near-misses and injuries from the field with photos, witnesses, and root-cause notes — before details fade.' },
  { icon: FileSearch, title: 'EHS Review', desc: 'Submit records for manager review with one tap. Reviewers approve or deny from an email link — no login needed.' },
  { icon: MessageCircle, title: 'Sage Assistant', desc: 'Ask a safety question mid-task and get an answer grounded in today\'s plan, your open permits, and recent incidents. Works offline.' },
]

const ROLES = [
  'EHS / Safety Manager',
  'Safety Officer / Coordinator',
  'Operations Manager',
  'Project / Site Manager',
  'Facilities Manager',
  'Lab Manager',
  'Engineer',
  'Other',
]

const MOBILE_SLIDES = [
  { label: 'Dashboard' },
  { label: 'AI Risk Analysis' },
  { label: 'Live Permits' },
  { label: 'SDS Binder' },
  { label: 'EHS Review' },
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
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const canSubmit = Boolean(name.trim() && email.trim() && company.trim() && role.trim())

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setSlide((s) => (s + 1) % MOBILE_SLIDES.length), 5000)
    return () => clearTimeout(t)
  }, [slide, paused])

  const total = MOBILE_SLIDES.length
  const slideCls = (i: number) =>
    `absolute inset-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
      i === slide
        ? 'opacity-100 translate-x-0 scale-100'
        : i === (slide + total - 1) % total
          ? 'opacity-0 -translate-x-14 scale-[0.97] pointer-events-none'
          : 'opacity-0 translate-x-14 scale-[0.97] pointer-events-none'
    }`

  const explainerCls = (i: number) =>
    `transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
      i === slide ? 'opacity-100 translate-y-0 delay-200' : 'opacity-0 translate-y-3 delay-0'
    }`

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

        <div className="relative max-w-3xl mx-auto px-4 pt-10 sm:pt-16 md:pt-20 pb-8 sm:pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#572DFF]/10 border border-[#572DFF]/25 text-[#A78BFF] text-xs font-medium mb-6 animate-blurIn">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#7C5CFF] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7C5CFF]" />
            </span>
            Early access — limited spots each week
          </div>
          <h1
            className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-4 sm:mb-5 animate-blurIn"
            style={{ animationDelay: '80ms' }}
          >
            Every job starts with a plan.
            <br />
            <span className="bg-gradient-to-br from-[#B9A3FF] via-[#7C5CFF] to-[#572DFF] bg-clip-text text-transparent">
              Make yours count.
            </span>
          </h1>
          <p
            className="text-base sm:text-lg text-[#9A9A9A] max-w-xl mx-auto leading-relaxed mb-8 animate-blurIn"
            style={{ animationDelay: '160ms' }}
          >
            Pre-task plans, work permits, and hazard analyses — drafted by AI,
            completed in minutes, and available offline at every job site.
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
              See what&apos;s included
            </a>
          </div>
          <p className="text-xs text-[#666] mt-5 animate-blurIn" style={{ animationDelay: '300ms' }}>
            Works offline · No app store needed · Installs from your browser
          </p>
        </div>

        {/* Product mockup with floating detail cards (desktop) */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-10 pb-8 md:pb-16">
          <div className="relative hidden md:block">
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
              className="pointer-events-none absolute inset-x-0 -bottom-1 h-32 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent"
            />

            {/* Floating satellites — absolutely positioned on md+, scroll row on mobile */}

            {/* Desktop: absolute floaters */}
            <div
              aria-hidden
              className="hidden md:block absolute -right-8 lg:-right-20 top-12 z-10 rotate-2 animate-blurIn"
              style={{ animationDelay: '600ms' }}
            >
              <div className="animate-float w-60 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
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
              className="hidden md:block absolute -left-8 lg:-left-20 top-48 z-10 -rotate-2 animate-blurIn"
              style={{ animationDelay: '700ms' }}
            >
              <div
                className="animate-floatSlow w-52 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
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
              className="hidden lg:block absolute -right-12 bottom-28 z-10 rotate-1 animate-blurIn"
              style={{ animationDelay: '800ms' }}
            >
              <div
                className="animate-float w-56 rounded-xl border border-[#2E2E2E] bg-[#141414]/90 backdrop-blur-md p-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-center gap-2.5"
                style={{ animationDelay: '3s' }}
              >
                <CheckCircle2 className="w-4 h-4 text-[#34C172] shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-white">PTP approved</p>
                  <p className="text-[9px] text-[#9A9A9A]">Reviewed by EHS · just now</p>
                </div>
              </div>
            </div>

          </div>

          {/* Mobile: rotating module showcase — each screen with its floating explainer */}
          <div className="md:hidden animate-blurIn" style={{ animationDelay: '320ms' }}>
            <div
              className="relative h-[400px] max-w-sm mx-auto"
              role="region"
              aria-roledescription="carousel"
              aria-label="Product feature showcase"
              onPointerEnter={() => setPaused(true)}
              onPointerLeave={() => setPaused(false)}
            >
              {/* Slide 1 — Home dashboard + EHS approval toast */}
              <div className={slideCls(0)}>
                <div className="relative">
                  <div className="rounded-xl p-px bg-gradient-to-b from-[#3A3A3A] via-[#1F1F1F] to-[#1F1F1F] shadow-[0_0_80px_-20px_rgba(87,45,255,0.45)] select-none">
                    <div className="rounded-[11px] bg-[#0A0A0A] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1F1F1F] bg-[#0D0D0D]">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#E66A6A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#F0B53A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#34C172]/60" />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-bold text-white">Sage</span>
                          <span className="text-[8px] font-semibold text-[#7C5CFF]">EHS</span>
                        </div>
                        <div className="w-5 h-5 rounded-full bg-[#572DFF]/20 border border-[#572DFF]/30 flex items-center justify-center text-[7px] font-semibold text-[#A78BFF]">
                          MS
                        </div>
                      </div>
                      <div className="px-4 py-4 space-y-3.5">
                        <div className="flex items-end justify-between">
                          <p className="text-sm font-bold text-white">Hello, Mark</p>
                          <p className="text-[9px] text-[#9A9A9A]">Thursday, June 11</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Today's PTP", value: 'Logged', sub: '5 signed', cls: 'text-[#34C172]' },
                            { label: 'Permits', value: '2', sub: 'open now', cls: 'text-white' },
                            { label: 'Incidents', value: '0', sub: '7 days', cls: 'text-white' },
                          ].map(({ label, value, sub, cls }) => (
                            <div key={label} className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-2.5">
                              <p className="text-[8px] uppercase tracking-[0.1em] text-[#9A9A9A]">{label}</p>
                              <p className={`text-xs font-semibold mt-0.5 ${cls}`}>{value}</p>
                              <p className="text-[8px] text-[#666]">{sub}</p>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-[8px] uppercase tracking-[0.1em] text-[#9A9A9A] font-semibold">
                              Quick actions
                            </p>
                            <div className="flex-1 h-px bg-gradient-to-r from-[#2E2E2E] to-transparent" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { icon: ClipboardList, label: 'Start PTP', primary: true },
                              { icon: ListChecks, label: 'Hazard Analysis' },
                              { icon: Flame, label: 'Hot Work' },
                              { icon: AlertTriangle, label: 'Report Incident' },
                            ].map(({ icon: Icon, label, primary }) => (
                              <div
                                key={label}
                                className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[9px] font-medium border ${
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
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 right-2 rotate-1">
                    <div className={`w-56 rounded-xl border border-[#2E2E2E] bg-[#141414]/95 backdrop-blur-md p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center gap-2.5 ${explainerCls(0)}`}>
                      <CheckCircle2 className="w-4 h-4 text-[#34C172] shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-white">PTP approved</p>
                        <p className="text-[9px] text-[#9A9A9A]">Reviewed by EHS · just now</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 2 — Job Hazard Analysis + Sage AI explainer */}
              <div className={slideCls(1)}>
                <div className="relative">
                  <div className="rounded-xl p-px bg-gradient-to-b from-[#3A3A3A] via-[#1F1F1F] to-[#1F1F1F] shadow-[0_0_80px_-20px_rgba(87,45,255,0.45)] select-none">
                    <div className="rounded-[11px] bg-[#0A0A0A] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1F1F1F] bg-[#0D0D0D]">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#E66A6A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#F0B53A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#34C172]/60" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ListChecks className="w-3 h-3 text-[#7C5CFF]" />
                          <span className="text-[10px] font-semibold text-white">Job Hazard Analysis</span>
                        </div>
                        <span className="text-[8px] font-mono text-[#9A9A9A]">JHA-0027</span>
                      </div>
                      <div className="px-4 py-4 space-y-3">
                        <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
                          <p className="text-[8px] uppercase tracking-[0.1em] text-[#9A9A9A] mb-1">Step 1</p>
                          <p className="text-[11px] text-white">Align conveyor drive coupling</p>
                        </div>
                        <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-white">Pinch points at rotating coupling</p>
                          </div>
                          <p className="text-[9px] text-[#9A9A9A]">
                            Controls: LOTO verified · cut-resistant gloves · two-person alignment
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-[#E66A6A]/10 text-[#E66A6A]">Risk 16</span>
                            <ArrowRight className="w-2.5 h-2.5 text-[#666]" />
                            <span className="px-1.5 py-0.5 rounded bg-[#34C172]/10 text-[#34C172]">Risk 4</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {['Hard hat', 'Safety glasses', 'Cut-resistant gloves'].map((ppe) => (
                            <span
                              key={ppe}
                              className="text-[8px] px-2 py-1 rounded-full border border-[#2E2E2E] text-[#C4C4C4]"
                            >
                              {ppe}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 left-2 -rotate-1">
                    <div className={`w-60 rounded-xl border border-[#2E2E2E] bg-[#141414]/95 backdrop-blur-md p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)] ${explainerCls(1)}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#7C5CFF]" />
                      <p className="text-[10px] font-semibold text-white">Sage suggests</p>
                    </div>
                    <p className="text-[9px] text-[#C4C4C4] leading-relaxed">
                      Drafts the hazards, controls, and risk scores for every step you enter.
                    </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 3 — Hot Work permit + live countdown explainer */}
              <div className={slideCls(2)}>
                <div className="relative">
                  <div className="rounded-xl p-px bg-gradient-to-b from-[#3A3A3A] via-[#1F1F1F] to-[#1F1F1F] shadow-[0_0_80px_-20px_rgba(87,45,255,0.45)] select-none">
                    <div className="rounded-[11px] bg-[#0A0A0A] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1F1F1F] bg-[#0D0D0D]">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#E66A6A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#F0B53A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#34C172]/60" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Flame className="w-3 h-3 text-[#F2934A]" />
                          <span className="text-[10px] font-semibold text-white">Hot Work Permit</span>
                        </div>
                        <span className="flex items-center gap-1 text-[8px] text-[#34C172]">
                          <span className="w-1 h-1 rounded-full bg-[#34C172] animate-pulse" />
                          Active
                        </span>
                      </div>
                      <div className="px-4 py-4 space-y-3">
                        <div>
                          <p className="text-[9px] font-mono text-[#9A9A9A]">HW-0042 · Bay 4 mezzanine</p>
                          <p className="text-xl font-mono font-semibold text-white tracking-tight mt-1">
                            02:14:36{' '}
                            <span className="text-[9px] text-[#9A9A9A] font-sans font-normal">remaining</span>
                          </p>
                        </div>
                        <div className="space-y-2">
                          {[
                            'Fire watch posted',
                            'Combustibles cleared 35 ft',
                            'Extinguisher staged at point of work',
                          ].map((item) => (
                            <div
                              key={item}
                              className="flex items-center gap-2 bg-[#141414] border border-[#1F1F1F] rounded-md px-3 py-2"
                            >
                              <CheckCircle2 className="w-3 h-3 text-[#34C172] shrink-0" />
                              <p className="text-[10px] text-[#C4C4C4]">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 right-2 rotate-1">
                    <div className={`w-60 rounded-xl border border-[#2E2E2E] bg-[#141414]/95 backdrop-blur-md p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)] ${explainerCls(2)}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Flame className="w-3.5 h-3.5 text-[#F2934A]" />
                      <p className="text-[10px] font-semibold text-white">Live permits</p>
                    </div>
                    <p className="text-[9px] text-[#C4C4C4] leading-relaxed">
                      Checklists gate issuance — then a live countdown tracks expiry in the field.
                    </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 4 — SDS Binder */}
              <div className={slideCls(3)} role="group" aria-roledescription="slide" aria-label="4 of 5: SDS Binder">
                <div className="relative">
                  <div className="rounded-xl p-px bg-gradient-to-b from-[#3A3A3A] via-[#1F1F1F] to-[#1F1F1F] shadow-[0_0_80px_-20px_rgba(87,45,255,0.45)] select-none">
                    <div className="rounded-[11px] bg-[#0A0A0A] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1F1F1F] bg-[#0D0D0D]">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#E66A6A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#F0B53A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#34C172]/60" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FlaskConical className="w-3 h-3 text-[#7C5CFF]" />
                          <span className="text-[10px] font-semibold text-white">SDS Binder</span>
                        </div>
                        <span className="text-[8px] font-mono text-[#9A9A9A]">GHS</span>
                      </div>
                      <div className="px-4 py-4 space-y-3">
                        <div className="relative">
                          <div className="w-full bg-[#141414] border border-[#1F1F1F] rounded-lg py-2 px-3 text-[10px] text-[#9A9A9A]">
                            Search chemicals, products, or CAS #
                          </div>
                        </div>
                        <div className="space-y-2">
                          {[
                            { name: 'Acetone', cas: '67-64-1', hazard: 'Flammable' },
                            { name: 'Sulfuric Acid', cas: '7664-93-9', hazard: 'Corrosive' },
                            { name: 'Isopropyl Alcohol', cas: '67-63-0', hazard: 'Flammable' },
                          ].map(({ name, cas, hazard }) => (
                            <div
                              key={name}
                              className="flex items-center justify-between bg-[#141414] border border-[#1F1F1F] rounded-md px-3 py-2.5"
                            >
                              <div>
                                <p className="text-[10px] font-medium text-white">{name}</p>
                                <p className="text-[8px] font-mono text-[#9A9A9A]">CAS {cas}</p>
                              </div>
                              <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-[#F0B53A]/10 text-[#F0B53A]">
                                {hazard}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
                          <p className="text-[8px] uppercase tracking-[0.1em] text-[#9A9A9A] mb-1">First Aid</p>
                          <p className="text-[9px] text-[#C4C4C4] leading-relaxed">
                            Inhalation: Move to fresh air. Skin: Wash with soap and water for 15 min.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 left-2 -rotate-1">
                    <div className={`w-56 rounded-xl border border-[#2E2E2E] bg-[#141414]/95 backdrop-blur-md p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center gap-2.5 ${explainerCls(3)}`}>
                      <FlaskConical className="w-4 h-4 text-[#7C5CFF] shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-white">Always available</p>
                        <p className="text-[9px] text-[#9A9A9A]">SDS lookup works offline at every site</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 5 — EHS Review */}
              <div className={slideCls(4)} role="group" aria-roledescription="slide" aria-label="5 of 5: EHS Review">
                <div className="relative">
                  <div className="rounded-xl p-px bg-gradient-to-b from-[#3A3A3A] via-[#1F1F1F] to-[#1F1F1F] shadow-[0_0_80px_-20px_rgba(87,45,255,0.45)] select-none">
                    <div className="rounded-[11px] bg-[#0A0A0A] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1F1F1F] bg-[#0D0D0D]">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#E66A6A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#F0B53A]/60" />
                          <span className="w-2 h-2 rounded-full bg-[#34C172]/60" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileSearch className="w-3 h-3 text-[#7C5CFF]" />
                          <span className="text-[10px] font-semibold text-white">EHS Review</span>
                        </div>
                        <span className="text-[8px] font-mono text-[#9A9A9A]">Inbox</span>
                      </div>
                      <div className="px-4 py-4 space-y-3">
                        <div className="space-y-2">
                          {[
                            { id: 'PTP-0118', title: 'Conveyor drive install', status: 'Approved', cls: 'text-[#34C172] bg-[#34C172]/10' },
                            { id: 'JHA-0027', title: 'Coupling alignment', status: 'Pending', cls: 'text-[#F0B53A] bg-[#F0B53A]/10' },
                            { id: 'HW-0043', title: 'Pipe welding — Bay 6', status: 'Pending', cls: 'text-[#F0B53A] bg-[#F0B53A]/10' },
                          ].map(({ id, title, status, cls }) => (
                            <div
                              key={id}
                              className="flex items-center justify-between bg-[#141414] border border-[#1F1F1F] rounded-md px-3 py-2.5"
                            >
                              <div>
                                <p className="text-[8px] font-mono text-[#9A9A9A]">{id}</p>
                                <p className="text-[10px] text-white">{title}</p>
                              </div>
                              <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full ${cls}`}>
                                {status}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-3 text-center">
                          <p className="text-[10px] text-[#C4C4C4] mb-2">Reviewers approve from email</p>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#34C172] text-white text-[9px] font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirm Approval
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 right-2 rotate-1">
                    <div className={`w-56 rounded-xl border border-[#2E2E2E] bg-[#141414]/95 backdrop-blur-md p-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center gap-2.5 ${explainerCls(4)}`}>
                      <CheckCircle2 className="w-4 h-4 text-[#34C172] shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-white">One-tap review</p>
                        <p className="text-[9px] text-[#9A9A9A]">Managers approve from an email link</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide selector + pause */}
            <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 mt-10">
              {MOBILE_SLIDES.map(({ label }, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-current={i === slide ? 'true' : undefined}
                  aria-label={`Show ${label} slide`}
                  className={`text-[10px] font-medium px-3 py-1.5 rounded-full border transition-colors min-h-[44px] ${
                    i === slide
                      ? 'border-[#572DFF]/50 bg-[#572DFF]/10 text-[#A78BFF]'
                      : 'border-[#2E2E2E] text-[#9A9A9A]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex justify-center mt-3">
              <a
                href="#signup"
                className="text-xs text-[#A78BFF] inline-flex items-center gap-1 hover:text-white transition-colors"
              >
                Request early access <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Feature grid */}
      <section id="features" className="max-w-5xl mx-auto px-4 pb-12 scroll-mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-gradient-to-br from-[#572DFF]/5 to-[#141414] border border-[#572DFF]/20 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#572DFF]/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-[#572DFF]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">How Sage works</h3>
              <p className="text-xs text-[#9A9A9A]">Three steps — every shift, every job</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#572DFF]/20 text-[#A78BFF] text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <p className="text-xs font-semibold text-white">Describe the job</p>
                <p className="text-xs text-[#9A9A9A]">Sage drafts the hazards, PPE, and risk controls.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#572DFF]/20 text-[#A78BFF] text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <p className="text-xs font-semibold text-white">Review and sign on</p>
                <p className="text-xs text-[#9A9A9A]">Your crew walks through the risks before work starts.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#572DFF]/20 text-[#A78BFF] text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <p className="text-xs font-semibold text-white">Work begins</p>
                <p className="text-xs text-[#9A9A9A]">Permits track live. Incidents log from the field.</p>
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
              Tap &ldquo;Add to Home Screen&rdquo; in your browser — no App Store, no IT department.
              Your team can be up and running in under a minute.
            </p>
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="hairline max-w-3xl mx-auto mb-12" />

      {/* Signup form */}
      <section id="signup" className="max-w-xl mx-auto px-4 pb-20">
        {submitted ? (
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#34C172] mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">You are on the list</h2>
            <p className="text-sm text-[#9A9A9A]">
              We will review your request and send setup instructions to <span className="text-white">{email}</span> —
              most invites go out within 24 hours.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg text-sm font-medium
                         border border-[#2E2E2E] text-[#C4C4C4] hover:border-[#572DFF]/40 hover:text-white transition-colors"
            >
              Back to Sage EHS
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-0.5">Get early access</h2>
              <p className="text-xs text-[#9A9A9A]">
                We are onboarding teams in small groups to ensure great support.
                Tell us about your team — most invites go out within a day.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="beta-name" className="block text-xs text-[#9A9A9A] mb-1">Full name <span aria-hidden="true" className="text-[#E66A6A]">*</span></label>
                <input id="beta-name" type="text" required autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label htmlFor="beta-email" className="block text-xs text-[#9A9A9A] mb-1">Work email <span aria-hidden="true" className="text-[#E66A6A]">*</span></label>
                <input id="beta-email" type="email" required autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="beta-company" className="block text-xs text-[#9A9A9A] mb-1">Company <span aria-hidden="true" className="text-[#E66A6A]">*</span></label>
                <input id="beta-company" type="text" required autoComplete="organization" maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Construction" className={inputCls} />
              </div>
              <div>
                <label htmlFor="beta-role" className="block text-xs text-[#9A9A9A] mb-1">Your role <span aria-hidden="true" className="text-[#E66A6A]">*</span></label>
                <select id="beta-role" value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} ${!role ? 'text-[#666]' : ''}`}>
                  <option value="" disabled>Select role</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="beta-crew" className="block text-xs text-[#9A9A9A] mb-1">Team size (approximate)</label>
              <input id="beta-crew" type="text" maxLength={50} value={crewSize} onChange={(e) => setCrewSize(e.target.value)} placeholder="e.g. 25 field crew, 3 safety officers" className={inputCls} />
            </div>

            <div>
              <label htmlFor="beta-reason" className="block text-xs text-[#9A9A9A] mb-1">What are you hoping to solve?</label>
              <textarea id="beta-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Safety docs slow us down, hazard tracking is manual, need better permit workflows..." className={`${inputCls} resize-none`} />
            </div>

            {error && (
              <p role="alert" className="text-xs text-[#E66A6A]">{error}</p>
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

            <p className="text-xs text-fg-3 text-center">
              We only use your info to process this request and send beta access instructions.
            </p>
          </form>
        )}
      </section>
    </div>
  )
}
