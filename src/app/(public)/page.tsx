import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback-state'
import {
  hasPublicDatabaseConfiguration,
  listRuntimePublicCompetitions,
} from '@/server/queries/public-navigation'
import { uiText } from '@/shared/i18n/ui-text'

async function CompetitionList() {
  await connection()

  if (!hasPublicDatabaseConfiguration()) {
    return (
      <ErrorState
        title={uiText.public.unavailableTitle}
        description={uiText.public.unavailableDescription}
      />
    )
  }

  const competitions = await listRuntimePublicCompetitions()
  if (competitions.length === 0) {
    return (
      <EmptyState
        title={uiText.public.competitionsEmptyTitle}
        description={uiText.public.competitionsEmptyDescription}
      />
    )
  }

  return (
    <ul className="public-index" aria-label={uiText.public.competitionsTitle}>
      {competitions.map((competition) => (
        <li key={competition.id}>
          <Link
            className="public-index-link"
            href={`/competitions/${encodeURIComponent(competition.slug)}`}
          >
            <span className="public-index-copy">
              <strong>{competition.name}</strong>
              {competition.description && <span>{competition.description}</span>}
            </span>
            <span className="public-index-action">{uiText.public.viewCompetition}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function HomePage() {
  return (
    <div className="public-page">
      <section className="public-hero" aria-labelledby="portal-title">
        <p className="public-overline">{uiText.public.kicker}</p>
        <h1 id="portal-title">{uiText.public.title}</h1>
        <p className="public-lead">{uiText.public.summary}</p>
      </section>

      <section className="public-section" id="competitions" aria-labelledby="competitions-title">
        <div className="public-section-heading">
          <h2 id="competitions-title">{uiText.public.competitionsTitle}</h2>
          <p>{uiText.public.competitionsDescription}</p>
        </div>
        <Suspense fallback={<LoadingState label={uiText.feedback.loading} />}>
          <CompetitionList />
        </Suspense>
      </section>
    </div>
  )
}
