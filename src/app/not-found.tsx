import type { Metadata } from 'next'
import Link from 'next/link'

import { uiText } from '@/shared/i18n/ui-text'

export const metadata: Metadata = {
  title: uiText.notFound.metadataTitle,
}

export default function NotFound() {
  return (
    <main id="main-content" className="feedback-page">
      <p className="portal-kicker">{uiText.notFound.kicker}</p>
      <h1>{uiText.notFound.title}</h1>
      <p>{uiText.notFound.description}</p>
      <Link className="primary-action" href="/">
        {uiText.notFound.backHome}
      </Link>
    </main>
  )
}
