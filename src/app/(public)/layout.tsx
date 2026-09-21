import Link from 'next/link'
import type { ReactNode } from 'react'

import { uiText } from '@/shared/i18n/ui-text'

type PublicLayoutProps = Readonly<{
  children: ReactNode
}>

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand-link" href="/">
          {uiText.brand.name}
        </Link>
        <nav aria-label={uiText.navigation.publicLabel}>
          <Link className="nav-link" href="/">
            {uiText.navigation.home}
          </Link>
        </nav>
      </header>
      <main id="main-content" className="site-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">{uiText.public.footer}</footer>
    </div>
  )
}
