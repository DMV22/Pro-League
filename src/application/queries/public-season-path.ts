export type PublicCompetition = {
  id: string
  name: string
}

export const publicParticipationStates = [
  'registered',
  'suspended',
  'withdrawn',
  'disqualified',
] as const
export type PublicParticipationState = (typeof publicParticipationStates)[number]

export const publicMatchSportingStates = [
  'unscheduled',
  'scheduled',
  'postponed',
  'in_progress',
  'suspended',
  'finished',
  'cancelled',
] as const
export type PublicMatchSportingState = (typeof publicMatchSportingStates)[number]

export type PublicSeasonEntry = {
  id: string
  teamId: string
  teamName: string
  participationState: PublicParticipationState
}

export type PublicMatchParticipant = {
  seasonEntryId: string
  teamId: string
  teamName: string
}

export type PublicMatchResult =
  | {
      id: string
      kind: 'played'
      confirmedAt: string
      homeRegulationGoals: number
      awayRegulationGoals: number
      homeExtraTimeGoals: number | null
      awayExtraTimeGoals: number | null
    }
  | {
      id: string
      kind: 'technical'
      confirmedAt: string
      homeGoals: number
      awayGoals: number
    }

export type PublicMatch = {
  id: string
  sportingState: PublicMatchSportingState
  /** This projection excludes Matches with unresolved or non-public participants. */
  home: PublicMatchParticipant
  away: PublicMatchParticipant
  kickoffOn: string | null
  kickoffAtLocal: string | null
  timezone: string | null
  result: PublicMatchResult | null
}

export type PublicFixtureRound = {
  id: string
  stageId: string
  code: string
  position: number
  matches: PublicMatch[]
}

export type PublicStandingsInput =
  import('../../modules/standings-progression/domain/provisional-league-standings').LeagueStandingsInput

export type PublicSeasonContent = {
  competition: PublicCompetition
  season: {
    id: string
    name: string
    sportingState: string
    timezone: string
  }
  entries: PublicSeasonEntry[]
  fixtureRounds: PublicFixtureRound[]
}

export interface PublicSeasonContentQueries {
  listCompetitions(): Promise<PublicCompetition[]>
  /** Null means missing/private parent. Empty arrays mean no Published children. No snapshot guarantee across SELECTs. */
  getSeasonContent(competitionId: string, seasonId: string): Promise<PublicSeasonContent | null>
}

export type PublicSeasonStandingsInputs = Pick<PublicSeasonContent, 'competition' | 'season'> & {
  standingsInputs: PublicStandingsInput[]
}

export interface PublicSeasonStandingsQueries {
  /** Low-level inputs: null means a missing/private parent. The caller must own the snapshot; runtime callers use createPublicLeagueStandingsQuery. */
  getStandingsInputs(
    competitionId: string,
    seasonId: string,
  ): Promise<PublicSeasonStandingsInputs | null>
}
