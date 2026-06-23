'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Phone,
  Star,
  AlertTriangle,
  Shield,
  Droplets,
  Eye,
  Wind,
  Flame,
  ChevronDown,
} from 'lucide-react'
import type { SdsRecord, GhsPictogramCode } from '@/lib/sds-types'
import { SIGNAL_WORD_STYLES } from '@/lib/sds-types'
import { getSdsById, toggleFavorite, onSdsChange } from '@/lib/sds-records'
import { RecordViewSkeleton } from '@/components/Skeleton'
import GhsPictogram from './GhsPictogram'

interface SdsDetailProps {
  id: string
}

const FIRST_AID_ROUTES = [
  { key: 'inhalation' as const, label: 'Inhalation', icon: Wind },
  { key: 'skin' as const, label: 'Skin Contact', icon: Droplets },
  { key: 'eyes' as const, label: 'Eye Contact', icon: Eye },
  { key: 'ingestion' as const, label: 'Ingestion', icon: AlertTriangle },
]

export default function SdsDetail({ id }: SdsDetailProps) {
  const [record, setRecord] = useState<SdsRecord | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([1, 2]))

  const load = useCallback(() => {
    const r = getSdsById(id)
    setRecord(r ?? null)
    setLoaded(true)
  }, [id])

  useEffect(() => {
    load()
    const unsub = onSdsChange(load)
    return unsub
  }, [load])

  const handleToggleFavorite = useCallback(() => {
    if (record) toggleFavorite(record.id)
  }, [record])

  const toggleSection = useCallback((num: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }, [])

  if (!loaded) return <RecordViewSkeleton />

  if (!record) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fadeIn">
        <Link
          href="/sds"
          className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg
                     min-h-[44px] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          SDS Library
        </Link>
        <div className="bg-mytra-card border border-mytra-border rounded-card p-8 shadow-card text-center">
          <AlertTriangle className="w-8 h-8 text-warn mx-auto mb-3" />
          <p className="text-sm font-medium text-fg mb-1">Chemical not found</p>
          <p className="text-xs text-fg-3">This Safety Data Sheet may have been removed.</p>
        </div>
      </div>
    )
  }

  const signalColor = SIGNAL_WORD_STYLES[record.signalWord]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fadeIn">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/sds"
          className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg
                     min-h-[44px] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          SDS Library
        </Link>
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={record.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center
                     text-fg-4 hover:text-warn transition-colors"
        >
          <Star className={`w-5 h-5 ${record.isFavorite ? 'fill-warn text-warn' : ''}`} />
        </button>
      </div>

      {/* Header Card */}
      <div className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-fg leading-snug">{record.productName}</h1>
            <p className="text-sm text-fg-3 mt-0.5">{record.manufacturer}</p>
          </div>
          {record.signalWord !== 'None' && (
            <span
              className="shrink-0 text-sm font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, ${signalColor} 15%, transparent)`, color: signalColor }}
            >
              {record.signalWord}
            </span>
          )}
        </div>

        {/* Pictograms */}
        <div className="flex items-center gap-2 flex-wrap">
          {record.pictograms.map((code: GhsPictogramCode) => (
            <GhsPictogram key={code} code={code} size={36} />
          ))}
        </div>

        {/* CAS Numbers */}
        {record.casNumbers.length > 0 && (
          <p className="text-xs font-mono text-fg-3 tabular-nums">
            CAS: {record.casNumbers.join(', ')}
          </p>
        )}
      </div>

      {/* Emergency Action Strip */}
      {record.emergencyPhone && (
        <a
          href={`tel:${record.emergencyPhone}`}
          className="flex items-center justify-center gap-2 bg-danger/10 border border-danger/20
                     rounded-card px-4 py-3 min-h-[44px] press-scale transition-colors
                     hover:bg-danger/15"
        >
          <Phone className="w-4 h-4 text-danger" />
          <span className="text-sm font-semibold text-danger">
            Emergency: {record.emergencyPhone}
          </span>
        </a>
      )}

      {/* Hazard Statements */}
      {record.hazardStatements.length > 0 && (
        <section className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">
            Hazard Statements
          </h2>
          <ul className="space-y-1">
            {record.hazardStatements.map((h, i) => (
              <li key={i} className="text-sm text-fg flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0 mt-0.5" />
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* First Aid Cards */}
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">
          First Aid Measures
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {FIRST_AID_ROUTES.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="bg-mytra-card border border-mytra-border rounded-card p-3 shadow-card"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-4 h-4 text-mytra-purple shrink-0" />
                <span className="text-xs font-semibold text-fg">{label}</span>
              </div>
              <p className="text-xs text-fg-2 leading-relaxed">
                {record.firstAid[key]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* PPE Required */}
      {record.ppeRequired.length > 0 && (
        <section className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            PPE Required
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {record.ppeRequired.map((ppe, i) => (
              <span
                key={i}
                className="inline-block text-xs font-medium px-2.5 py-1 rounded-full
                           bg-mytra-purple/10 text-mytra-purple border border-mytra-purple/20"
              >
                {ppe}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Fire / Spill / Storage Quick Cards */}
      <div className="grid grid-cols-1 gap-2">
        {record.fireExtinguishing && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-3 shadow-card">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Flame className="w-4 h-4 text-danger shrink-0" />
              <span className="text-xs font-semibold text-fg">Fire-Fighting</span>
            </div>
            <p className="text-xs text-fg-2 leading-relaxed">{record.fireExtinguishing}</p>
          </div>
        )}
        {record.spillProcedure && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-3 shadow-card">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Droplets className="w-4 h-4 text-[#3B82F6] shrink-0" />
              <span className="text-xs font-semibold text-fg">Spill Response</span>
            </div>
            <p className="text-xs text-fg-2 leading-relaxed">{record.spillProcedure}</p>
          </div>
        )}
        {record.storageHandling && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-3 shadow-card">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Shield className="w-4 h-4 text-ok shrink-0" />
              <span className="text-xs font-semibold text-fg">Storage & Handling</span>
            </div>
            <p className="text-xs text-fg-2 leading-relaxed">{record.storageHandling}</p>
          </div>
        )}
      </div>

      {/* Full 16-Section Accordion */}
      {record.sections.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1 mb-2">
            Full SDS Sections
          </h2>
          {record.sections.map((section) => {
            const isOpen = openSections.has(section.number)
            const panelId = `sds-section-${section.number}`
            const headerId = `sds-header-${section.number}`
            return (
              <div
                key={section.number}
                className="bg-mytra-card border border-mytra-border rounded-card shadow-card overflow-hidden"
              >
                <button
                  type="button"
                  id={headerId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleSection(section.number)}
                  className="w-full flex items-center justify-between px-4 py-3 min-h-[44px]
                             text-left hover:bg-mytra-card-hover transition-colors"
                >
                  <span className="text-sm text-fg font-medium flex items-center gap-2">
                    <span className="text-xs text-fg-4 font-mono tabular-nums w-5">
                      {section.number}.
                    </span>
                    {section.title}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-fg-4 shrink-0 transition-transform duration-200
                               ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    className="px-4 pb-3 animate-fadeIn"
                  >
                    <p className="text-xs text-fg-2 leading-relaxed whitespace-pre-line">
                      {section.content}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* Precautionary Statements */}
      {record.precautionaryStatements.length > 0 && (
        <section className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">
            Precautionary Statements
          </h2>
          <ul className="space-y-1">
            {record.precautionaryStatements.map((s, i) => (
              <li key={i} className="text-xs text-fg-2 leading-relaxed">
                • {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bottom spacing for mobile tab bar */}
      <div className="h-4" aria-hidden="true" />
    </div>
  )
}
