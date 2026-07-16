'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Archive } from 'lucide-react'
import { getQuarantinedRecords } from '@/lib/safety-records'
import { useT } from '@/lib/i18n'
import type { MessageKey } from '@/lib/i18n-keys'

const STORE_LABEL_KEYS: Record<string, { key: MessageKey; en: string }> = {
  'eqr-safety-records': { key: 'storage.safetyStore', en: 'Safety records' },
  'eqr-inspections': { key: 'storage.inspectionStore', en: 'Inspection records' },
}

const QUARANTINE_DISMISS_KEY = 'eqr-quarantine-dismissed-at'

export default function StorageAlert() {
  const t = useT()
  const [visible, setVisible] = useState(false)
  const [store, setStore] = useState(STORE_LABEL_KEYS['eqr-safety-records'])
  const [quarantineCount, setQuarantineCount] = useState(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail?.key as string | undefined
      if (key && STORE_LABEL_KEYS[key]) setStore(STORE_LABEL_KEYS[key])
      setVisible(true)
    }
    window.addEventListener('eqr:storage-corruption', handler)
    return () => window.removeEventListener('eqr:storage-corruption', handler)
  }, [])

  useEffect(() => {
    // Show the quarantine notice when records were set aside, unless the user
    // already dismissed at this count — a NEW quarantined record re-shows it.
    const refresh = (count: number) => {
      let dismissedAt = 0
      try { dismissedAt = parseInt(sessionStorage.getItem(QUARANTINE_DISMISS_KEY) || '0', 10) } catch { /* ignore */ }
      setQuarantineCount(count > dismissedAt ? count : 0)
    }
    refresh(getQuarantinedRecords().length)
    const handler = (e: Event) => {
      const total = (e as CustomEvent).detail?.total as number | undefined
      refresh(total ?? getQuarantinedRecords().length)
    }
    window.addEventListener('eqr:records-quarantined', handler)
    return () => window.removeEventListener('eqr:records-quarantined', handler)
  }, [])

  function dismissQuarantine() {
    try { sessionStorage.setItem(QUARANTINE_DISMISS_KEY, String(getQuarantinedRecords().length)) } catch { /* ignore */ }
    setQuarantineCount(0)
  }

  if (!visible && quarantineCount === 0) return null

  return (
    <div className="no-print fixed top-0 left-0 right-0 z-[80]">
      {visible && (
        <div className="bg-danger/95 text-white px-4 py-3 text-center">
          <div className="max-w-2xl mx-auto flex items-center gap-2 justify-center">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-sm font-medium">
              {t('storage.corrupt', { store: t(store.key, undefined, store.en) })}
            </p>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="ml-2 text-white/70 hover:text-white text-sm shrink-0 min-h-[44px] flex items-center"
            >
              {t('common.dismiss', undefined, 'Dismiss')}
            </button>
          </div>
        </div>
      )}
      {quarantineCount > 0 && (
        <div className="bg-warn/95 text-black px-4 py-3 text-center">
          <div className="max-w-2xl mx-auto flex items-center gap-2 justify-center">
            <Archive className="w-4 h-4 shrink-0" />
            <p className="text-sm font-medium">
              {t('storage.quarantined', { count: quarantineCount })}
            </p>
            <button
              type="button"
              onClick={dismissQuarantine}
              className="ml-2 text-black/60 hover:text-black text-sm shrink-0 min-h-[44px] flex items-center"
            >
              {t('common.dismiss', undefined, 'Dismiss')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
