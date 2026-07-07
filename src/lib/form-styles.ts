export const labelCls = 'block text-sm font-medium text-fg-2 mb-1'

export const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple'

export const textareaCls = `${inputCls} resize-none [field-sizing:content]`

/**
 * Canonical action-button colorways (DS-6). Color identity + states only —
 * sizing (py-*, min-h-[44px]) and layout stay per-site so the primitive never
 * fights local font/spacing utilities; UX-2 enforces the 44px hit area.
 */
export const btnPrimaryCls =
  'bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple'

export const btnSecondaryCls =
  'bg-mytra-input text-fg hover:bg-mytra-card-hover border border-mytra-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple'

/** Selected/active colorway for toggles, chips, and segmented controls —
 *  color identity only so it composes with any shape (rounded-full etc.). */
export const btnSelectedCls = 'bg-mytra-purple text-white'
