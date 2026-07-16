'use client'

import Link from 'next/link'
import { Search } from 'lucide-react'
import { btnPrimaryCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'

export default function NotFound() {
  const t = useT()
  return (
    <main id="main" className="min-h-screen bg-mytra-bg flex items-center justify-center px-4">
      <div className="text-center">
        <Search className="w-12 h-12 text-fg-4 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-fg mb-2">{t('errors.notFoundTitle', undefined, 'Page not found')}</h1>
        <p className="text-fg-3 text-sm mb-6">
          {t('errors.notFoundBody', undefined, 'The equipment or page you are looking for does not exist.')}
        </p>
        <Link
          href="/"
          className={`${btnPrimaryCls} inline-flex items-center gap-2 hover:bg-mytra-purple/80 text-sm font-medium px-5 py-2.5`}
        >
          {t('common.backHome', undefined, 'Back to Home')}
        </Link>
      </div>
    </main>
  )
}
