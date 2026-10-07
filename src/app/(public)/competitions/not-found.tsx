import Link from 'next/link'

import { EmptyState } from '@/components/ui/feedback-state'
import { uiText } from '@/shared/i18n/ui-text'

export default function PublicCompetitionNotFound() {
  return (
    <EmptyState
      title={uiText.notFound.title}
      description={uiText.notFound.description}
      headingLevel={1}
      action={<Link href="/#competitions">{uiText.public.backToCompetitions}</Link>}
    />
  )
}
