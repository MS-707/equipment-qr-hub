import { useState, useEffect, useRef, useCallback } from 'react'

const DRAFT_PREFIX = 'draft:'
const SAVE_DELAY = 2000

export function useFormDraft<T extends Record<string, unknown>>(
  formKey: string,
  getState: () => T,
  restoreState: (draft: T) => void
): { hasDraft: boolean; clearDraft: () => void; dismissDraft: () => void } {
  const [hasDraft, setHasDraft] = useState(false)
  const didRestore = useRef(false)
  const getStateRef = useRef(getState)
  getStateRef.current = getState

  useEffect(() => {
    if (didRestore.current) return
    didRestore.current = true
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + formKey)
      if (raw) {
        const parsed = JSON.parse(raw) as T
        const hasContent = Object.values(parsed).some(
          (v) =>
            (typeof v === 'string' && v.trim() !== '') ||
            (Array.isArray(v) && v.length > 0) ||
            (typeof v === 'boolean' && v) ||
            (typeof v === 'number' && v !== 0)
        )
        if (hasContent) {
          restoreState(parsed)
          setHasDraft(true)
        }
      }
    } catch {}
  }, [formKey, restoreState])

  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        const state = getStateRef.current()
        localStorage.setItem(DRAFT_PREFIX + formKey, JSON.stringify(state))
      } catch {}
    }, SAVE_DELAY)
    return () => clearTimeout(saveTimer.current)
  })

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_PREFIX + formKey)
    setHasDraft(false)
  }, [formKey])

  const dismissDraft = useCallback(() => {
    setHasDraft(false)
  }, [])

  return { hasDraft, clearDraft, dismissDraft }
}
