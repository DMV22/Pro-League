import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback-state'
import { uiText } from '@/shared/i18n/ui-text'

export const metadata: Metadata = {
  title: uiText.notFound.metadataTitle,
}

export default function NotFound() {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center p-4" tabIndex={-1}>
      <EmptyState
        title={uiText.notFound.title}
        description={uiText.notFound.description}
        headingLevel={1}
        action={
          <Button asChild>
            <Link href="/">{uiText.notFound.backHome}</Link>
          </Button>
        }
      />
    </main>
  )
}
