import type {
  PublicFixtureRound,
  PublicMatch,
  PublicSeasonEntry,
} from '@/application/queries/public-season-path'
import { uiText } from '@/shared/i18n/ui-text'

function formatKickoff(match: PublicMatch): string {
  if (!match.kickoffOn) {
    return match.sportingState === 'postponed'
      ? uiText.public.postponedKickoff
      : uiText.public.kickoffToBeAnnounced
  }

  const date = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${match.kickoffOn}T00:00:00Z`),
  )
  return match.kickoffAtLocal ? `${date}, ${match.kickoffAtLocal.slice(0, 5)}` : date
}

function matchScore(match: PublicMatch): string | null {
  if (!match.result) return null
  if (match.result.kind === 'technical') {
    return `${match.result.homeGoals}:${match.result.awayGoals}`
  }
  return `${match.result.homeRegulationGoals + (match.result.homeExtraTimeGoals ?? 0)}:${match.result.awayRegulationGoals + (match.result.awayExtraTimeGoals ?? 0)}`
}

export function SeasonEntries({ entries }: { entries: PublicSeasonEntry[] }) {
  return (
    <section className="public-section" aria-labelledby="season-entries-title">
      <div className="public-section-heading">
        <h2 id="season-entries-title">{uiText.public.seasonEntriesTitle}</h2>
        <p>{uiText.public.seasonEntriesDescription}</p>
      </div>
      {entries.length === 0 ? (
        <p>{uiText.public.seasonEntriesEmpty}</p>
      ) : (
        <ul className="public-season-entries">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>{entry.teamName}</span>
              <span className="public-entry-state">
                {uiText.public.participationStates[
                  entry.participationState as keyof typeof uiText.public.participationStates
                ] ?? entry.participationState}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MatchItem({ match }: { match: PublicMatch }) {
  const score = matchScore(match)
  const state =
    uiText.public.matchStates[match.sportingState as keyof typeof uiText.public.matchStates] ??
    match.sportingState

  return (
    <li className="public-match">
      <div className="public-match-main">
        <strong>
          {match.home?.teamName} <span aria-hidden="true">—</span>
          <span className="sr-only">проти</span> {match.away?.teamName}
        </strong>
        {score && (
          <strong className="public-match-score">
            <span className="sr-only">Рахунок </span>
            {score}
          </strong>
        )}
      </div>
      <p className="public-match-details">
        <span>{state}</span>
        <span aria-hidden="true">·</span>
        <span>{formatKickoff(match)}</span>
        {match.result?.kind === 'technical' && (
          <>
            <span aria-hidden="true">·</span>
            <span>{uiText.public.technicalResult}</span>
          </>
        )}
      </p>
    </li>
  )
}

export function FixtureRounds({ rounds }: { rounds: PublicFixtureRound[] }) {
  return (
    <section className="public-section" aria-labelledby="fixture-rounds-title">
      <div className="public-section-heading">
        <h2 id="fixture-rounds-title">{uiText.public.fixtureRoundsTitle}</h2>
        <p>{uiText.public.fixtureRoundsDescription}</p>
      </div>
      {rounds.length === 0 ? (
        <p>{uiText.public.fixtureRoundsEmpty}</p>
      ) : (
        <ol className="public-rounds">
          {rounds.map((round) => (
            <li key={round.id}>
              <section aria-label={`${uiText.public.fixtureRoundLabel} ${round.code}`}>
                <h3>
                  {uiText.public.fixtureRoundLabel} {round.code}
                </h3>
                <ol className="public-match-list">
                  {round.matches.map((match) => (
                    <MatchItem key={match.id} match={match} />
                  ))}
                </ol>
              </section>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
