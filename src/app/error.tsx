'use client'

import { useEffect } from 'react'

import { uiText } from '@/shared/i18n/ui-text'

type RootErrorProps = Readonly<{
  error: Error & { digest?: string }
  retry: () => void
}>

export default function RootError({ error, retry }: RootErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main id="main-content" className="grid min-h-screen place-items-center p-4" tabIndex={-1}>
      <section className="portal-card" role="alert" aria-labelledby="error-title">
        <h1 id="error-title">{uiText.feedback.errorTitle}</h1>
        <p className="portal-summary">{uiText.feedback.errorDescription}</p>
        <button className="error-action" type="button" onClick={retry}>
          {uiText.feedback.retry}
        </button>
      </section>
    </main>
  )
}
