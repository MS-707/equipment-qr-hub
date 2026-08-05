import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@/lib/i18n'
import Router from './router'
import './styles.css'

/**
 * Client entry for the Kin SPA.
 *
 * The real I18nProvider is mounted rather than relying on the context default.
 * useT() would work without it — src/lib/i18n.tsx:47 creates the context WITH a
 * working English t() — but the provider is what keeps document.documentElement.lang
 * in step with the stored locale and what the ported screens' useLocale() call
 * reads. Its kill-switch fetch of /api/i18n/status is unroutable on the Worker
 * today; the handler already treats a non-ok response as "keep last known good",
 * so a 501 there is inert.
 */

const host = document.getElementById('root')
if (!host) throw new Error('kin: #root is missing from the document shell')

createRoot(host).render(
  <StrictMode>
    <I18nProvider>
      <Router />
    </I18nProvider>
  </StrictMode>,
)
