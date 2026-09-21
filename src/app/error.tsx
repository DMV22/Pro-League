'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/feedback-state'
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
      <ErrorState
        title={uiText.feedback.errorTitle}
        description={uiText.feedback.errorDescription}
        headingLevel={1}
        action={
          <Button type="button" variant="outline" onClick={retry}>
            {uiText.feedback.retry}
          </Button>
        }
      />
    </main>
  )
}
