import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { appLocale, openGraphLocale } from '@/shared/i18n/config'
import { uiText } from '@/shared/i18n/ui-text'

import './globals.css'

export const metadata: Metadata = {
  applicationName: uiText.brand.name,
  title: {
    default: uiText.metadata.defaultTitle,
    template: `%s | ${uiText.brand.name}`,
  },
  description: uiText.metadata.description,
  openGraph: {
    type: 'website',
    locale: openGraphLocale,
    siteName: uiText.brand.name,
    title: uiText.metadata.defaultTitle,
    description: uiText.metadata.description,
  },
}

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang={appLocale.htmlLanguage}>
      <body>
        <a className="skip-link" href="#main-content">
          {uiText.accessibility.skipToContent}
        </a>
        {children}
      </body>
    </html>
  )
}
