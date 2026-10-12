import type {
  PublicCompetitionNavigation,
  PublicCompetitionPage,
  PublicSeasonPage,
} from './public-navigation'
import type { PublicSeasonContent } from './public-season-path'
import type { ProvisionalLeagueStandings } from '../../modules/standings-progression/domain/provisional-league-standings'

export type PublicProjectionRequest =
  | { kind: 'home' }
  | { kind: 'competition'; competitionSlug: string }
  | { kind: 'season'; competitionSlug: string; seasonSlug: string }

export type PublicProjectionState = {
  key: string
  revision: string
  lastUpdatedAt: string | null
  seasonDate: string | null
  seasonTimezone: string | null
  competitionId: string | null
  seasonId: string | null
}

export type PublicProjectionProbe =
  | { kind: 'found'; state: PublicProjectionState }
  | { kind: 'notFound' }
  | { kind: 'redirect'; pathname: string }

export type PublicProjectionPayload =
  | { kind: 'home'; competitions: PublicCompetitionNavigation[] }
  | ({ kind: 'competition' } & PublicCompetitionPage)
  | ({
      kind: 'season'
      content: PublicSeasonContent
      standings: ProvisionalLeagueStandings[]
    } & PublicSeasonPage)

export type PublicProjectionSnapshot = {
  state: PublicProjectionState
  payload: PublicProjectionPayload
}
export type PublicProjectionView =
  | {
      kind: 'ready'
      freshness: 'fresh' | 'stale'
      lastUpdatedAt: string | null
      payload: PublicProjectionPayload
    }
  | { kind: 'unavailable' }
  | { kind: 'notFound' }
  | { kind: 'redirect'; pathname: string }

/** Only connectivity failures permit a bounded last-verified public response. */
export class PublicProjectionUnavailable extends Error {}
export class PublicProjectionChanged extends Error {}
