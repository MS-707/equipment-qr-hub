import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { navigate } from '../navigation'

/**
 * Drop-in replacement for the framework's link component, wired into this
 * app's history router. kin/vite.config.ts aliases the bare specifier to this
 * file, so the ported screens keep their original import line and never need
 * editing.
 *
 * Prop surface is matched to what the two call sites in the closure actually
 * use — `href` (always a string) plus `className` and children:
 *   src/components/InspectLanding.tsx:66     -> /equipment/{itemNumber}
 *   src/components/PreTripInspection.tsx:1145 -> /inspections/record/{id}
 * The object-form href, `as`, and `legacyBehavior` are not implemented because
 * nothing in the port passes them; `replace`/`scroll`/`prefetch`/`shallow` are
 * accepted so a future call site compiles, and only `replace` has an effect.
 *
 * Click handling mirrors the real component: a plain left-click is intercepted
 * for client-side navigation, and anything the user meant to hand to the
 * browser — modified click, middle click, target, download, cross-origin or
 * non-http scheme — falls through untouched.
 */

interface LinkOwnProps {
  href: string
  children?: ReactNode
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean
  /** Accepted for source compatibility; this router always scrolls to top. */
  scroll?: boolean
  /** Accepted for source compatibility; there is nothing to prefetch. */
  prefetch?: boolean
  /** Accepted for source compatibility; no-op. */
  shallow?: boolean
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & LinkOwnProps

function isBrowserGesture(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, replace = false, scroll, prefetch, shallow, onClick, target, ...anchorProps },
  ref,
) {
  void scroll
  void prefetch
  void shallow

  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (isBrowserGesture(event)) return
    if (target && target !== '_self') return
    if (anchorProps.download !== undefined) return

    let url: URL
    try {
      url = new URL(href, window.location.href)
    } catch {
      return // mailto:, tel:, malformed — let the browser deal with it
    }
    if (url.origin !== window.location.origin) return

    event.preventDefault()
    navigate(`${url.pathname}${url.search}${url.hash}`, replace)
  }

  return (
    <a {...anchorProps} ref={ref} href={href} target={target} onClick={handleClick}>
      {children}
    </a>
  )
})

export default Link
