import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

import { ErrorState, LoadingState } from '@/components/ui/feedback-state'
import { FixtureRounds, SeasonEntries } from '@/components/public/season-content'
import {
  hasPublicDatabaseConfiguration,
  resolveRuntimePublicSeason,
} from '@/server/queries/public-navigation'
import { getRuntimePublicSeasonPathQueries } from '@/server/queries/public-season-path'
import { uiText } from '@/shared/i18n/ui-text'

type Props = PageProps<'/competitions/[competitionSlug]/seasons/[seasonSlug]'>
type ContentProps = Pick<Props, 'params'>

function formatSeasonDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitionSlug, seasonSlug } = await params
  if (!hasPublicDatabaseConfiguration()) return { robots: { index: false } }

  const result = await resolveRuntimePublicSeason(competitionSlug, seasonSlug)
  if (result.kind !== 'found') return { robots: { index: false } }

  return {
    title: `${result.value.season.name} — ${result.value.competition.name}`,
    description: `${uiText.public.seasonsTitle}: ${result.value.season.name}. ${result.value.competition.name}.`,
  }
}

async function SeasonContent({ params }: ContentProps) {
  const { competitionSlug, seasonSlug } = await params
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

  const result = await resolveRuntimePublicSeason(competitionSlug, seasonSlug)
  if (result.kind === 'redirect') permanentRedirect(result.pathname)
  if (result.kind === 'notFound') notFound()

  const { competition, season } = result.value
  const seasonPath = await getRuntimePublicSeasonPathQueries().getSeasonPath(
    competition.id,
    season.id,
  )
  if (!seasonPath) notFound()

  return (
    <div className="public-page">
      <nav className="public-breadcrumbs" aria-label="Навігаційний ланцюжок">
        <Link href="/#competitions">{uiText.navigation.competitions}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/competitions/${encodeURIComponent(competition.slug)}`}>
          {competition.name}
        </Link>
      </nav>
      <header className="public-detail-header">
        <p className="public-overline">{competition.name}</p>
        <h1>{season.name}</h1>
        <p className="public-lead">{uiText.public.seasonDetailDescription}</p>
      </header>
      <section className="public-season-overview" aria-label="Стан сезону">
        <div>
          <span className="public-fact-label">Стан</span>
          <strong>
            {uiText.public.sportingStates[
              season.sportingState as keyof typeof uiText.public.sportingStates
            ] ?? season.sportingState}
          </strong>
        </div>
        {season.startsOn && (
          <div>
            <span className="public-fact-label">Початок</span>
            <strong>{formatSeasonDate(season.startsOn)}</strong>
          </div>
        )}
        {season.archiveState === 'archived' && (
          <div>
            <span className="public-fact-label">Публікація</span>
            <strong>{uiText.public.archived}</strong>
          </div>
        )}
      </section>
      <SeasonEntries entries={seasonPath.entries} />
      <FixtureRounds rounds={seasonPath.fixtureRounds} />
    </div>
  )
}

export default function SeasonPage({ params }: Props) {
  return (
    <Suspense fallback={<LoadingState label={uiText.feedback.loading} />}>
      <SeasonContent params={params} />
    </Suspense>
  )
}
