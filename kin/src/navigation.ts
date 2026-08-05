/**
 * Navigation primitives for the slice SPA.
 *
 * Deliberately tiny and dependency-free. It lives in its own module — rather
 * than inside router.tsx — so the link shim can drive navigation without
 * importing the router, which would make shim -> router -> screens -> shim a
 * cycle.
 *
 * History API, not hash routing: kin/worker/index.js already falls back to
 * /index.html for any non-/assets/ GET that misses the manifest, so deep links
 * like /inspect/12 resolve server-side and real URLs survive a hard refresh.
 */

/** Fired after a programmatic pushState/replaceState so subscribers re-render. */
const NAV_EVENT = 'kin:navigation'

/** Current in-app path, including search and hash. */
export function currentPath(): string {
  const { pathname, search, hash } = window.location
  return `${pathname || '/'}${search}${hash}`
}

/**
 * Client-side navigation. Cross-origin targets are handed to the browser
 * instead — the caller may have passed an absolute URL.
 */
export function navigate(to: string, replace = false): void {
  const url = new URL(to, window.location.href)
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href)
    return
  }
  const next = `${url.pathname}${url.search}${url.hash}`
  if (replace) window.history.replaceState(null, '', next)
  else window.history.pushState(null, '', next)
  window.dispatchEvent(new Event(NAV_EVENT))
  if (!url.hash) window.scrollTo(0, 0)
}

/** Subscribe to back/forward and in-app navigation. Returns an unsubscribe. */
export function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAV_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAV_EVENT, onChange)
  }
}
