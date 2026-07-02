/**
 * Request persistent storage once the device holds real records.
 *
 * localStorage + IndexedDB are the system of record until sync — without
 * `navigator.storage.persist()` the browser may evict them under storage
 * pressure. Denial is non-fatal (Safari grants silently for installed PWAs;
 * Chrome scores engagement) — we log the outcome and never nag.
 */

let requested = false

/** Test hook — resets the once-per-session guard. */
export function _resetPersistRequestGuard(): void {
  requested = false
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || requested) return false
  const storage = navigator.storage
  if (!storage || typeof storage.persist !== 'function') return false
  requested = true
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) {
      return true
    }
    const granted = await storage.persist()
    console.info(`[storage] Persistent storage ${granted ? 'granted' : 'denied'}`)
    return granted
  } catch (e) {
    console.warn('[storage] persist request failed:', e)
    return false
  }
}
