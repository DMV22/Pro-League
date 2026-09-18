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
    <main id="main-content" className="feedback-page">
      <p className="portal-kicker">{uiText.feedback.errorKicker}</p>
      <h1>{uiText.feedback.errorTitle}</h1>
      <p>{uiText.feedback.errorDescription}</p>
      <button className="primary-action" type="button" onClick={retry}>
        {uiText.feedback.retry}
      </button>
    </main>
  )
}
