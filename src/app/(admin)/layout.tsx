import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { uiText } from '@/shared/i18n/ui-text'

export const metadata: Metadata = {
  title: uiText.admin.metadataTitle,
  description: uiText.admin.metadataDescription,
  robots: {
    index: false,
    follow: false,
  },
}

type AdminLayoutProps = Readonly<{
  children: ReactNode
}>

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">{uiText.admin.eyebrow}</p>
          <Link className="brand-link" href="/admin">
            {uiText.admin.title}
          </Link>
        </div>
        <nav className="admin-nav" aria-label={uiText.navigation.adminLabel}>
          <Link className="nav-link" href="/admin">
            {uiText.navigation.adminHome}
          </Link>
          <Link className="nav-link" href="/">
            {uiText.navigation.publicPortal}
          </Link>
        </nav>
      </header>
      <main id="main-content" className="admin-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
