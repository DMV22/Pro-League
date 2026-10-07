import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback-state'
import {
  hasPublicDatabaseConfiguration,
  resolveRuntimePublicCompetition,
} from '@/server/queries/public-navigation'
import { uiText } from '@/shared/i18n/ui-text'

type Props = PageProps<'/competitions/[competitionSlug]'>
type ContentProps = Pick<Props, 'params'>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitionSlug } = await params
  if (!hasPublicDatabaseConfiguration()) return { robots: { index: false } }

  const result = await resolveRuntimePublicCompetition(competitionSlug)
  if (result.kind !== 'found') return { robots: { index: false } }

  return {
    title: result.value.competition.name,
    description: result.value.competition.description ?? uiText.public.seasonsDescription,
  }
}

async function CompetitionContent({ params }: ContentProps) {
  const { competitionSlug } = await params
  await connection()

  if (!hasPublicDatabaseConfiguration()) {
    return (
      <ErrorState
        title={uiText.public.unavailableTitle}
        description={uiText.public.unavailableDescription}
        headingLevel={1}
      />
    )
  }

  const result = await resolveRuntimePublicCompetition(competitionSlug)
  if (result.kind === 'redirect') permanentRedirect(result.pathname)
  if (result.kind === 'notFound') notFound()

  const { competition, seasons } = result.value
  return (
    <div className="public-page">
      <nav className="public-breadcrumbs" aria-label="Навігаційний ланцюжок">
        <Link href="/#competitions">{uiText.public.backToCompetitions}</Link>
      </nav>
      <header className="public-detail-header">
        <p className="public-overline">{uiText.navigation.competitions}</p>
        <h1>{competition.name}</h1>
        {competition.description && <p className="public-lead">{competition.description}</p>}
      </header>
      <section className="public-section" aria-labelledby="seasons-title">
        <div className="public-section-heading">
          <h2 id="seasons-title">{uiText.public.seasonsTitle}</h2>
          <p>{uiText.public.seasonsDescription}</p>
        </div>
        {seasons.length === 0 ? (
          <EmptyState
            title={uiText.public.seasonsEmptyTitle}
            description={uiText.public.seasonsEmptyDescription}
          />
        ) : (
          <ul className="public-index" aria-label={uiText.public.seasonsTitle}>
            {seasons.map((season) => (
              <li key={season.id}>
                <Link
                  className="public-index-link"
                  href={`/competitions/${encodeURIComponent(competition.slug)}/seasons/${encodeURIComponent(season.slug)}`}
                >
                  <span className="public-index-copy">
                    <strong>{season.name}</strong>
                    <span>
                      {uiText.public.sportingStates[
                        season.sportingState as keyof typeof uiText.public.sportingStates
                      ] ?? season.sportingState}
                      {season.archiveState === 'archived' && ` · ${uiText.public.archived}`}
                    </span>
                  </span>
                  <span className="public-index-action">{uiText.public.viewSeason}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function CompetitionPage({ params }: Props) {
  return (
    <Suspense fallback={<LoadingState label={uiText.feedback.loading} />}>
      <CompetitionContent params={params} />
    </Suspense>
  )
}
