export type PublicCompetition = {
  id: string
  name: string
}

export type PublicSeasonEntry = {
  id: string
  teamId: string
  teamName: string
  participationState: string
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
  sportingState: string
  home: PublicMatchParticipant | null
  away: PublicMatchParticipant | null
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

export type PublicStandingsInput = {
  stageId: string
  stageVersionId: string
  rankingRuleSetId: string | null
  pointsScheme: { win: number; draw: number; loss: number } | null
  tieBreakers: Array<{ position: number; criterion: string; direction: string }>
  adjustmentDecisions: Array<{
    id: string
    seasonEntryId: string
    action: string
    pointsDelta: number | null
    effectiveOn: string
    supersedesDecisionId: string | null
  }>
  publishedResults: Array<{
    matchId: string
    resultVersionId: string
    homeSeasonEntryId: string
    awaySeasonEntryId: string
    homeGoals: number
    awayGoals: number
  }>
}

export type PublicSeasonPath = {
  competition: PublicCompetition
  season: {
    id: string
    name: string
    sportingState: string
    timezone: string
  }
  entries: PublicSeasonEntry[]
  fixtureRounds: PublicFixtureRound[]
  standingsInputs: PublicStandingsInput[]
}

export interface PublicSeasonPathQueries {
  listCompetitions(): Promise<PublicCompetition[]>
  /** Null means the Competition or Season is missing or not Public. Empty child arrays mean no Published children. */
  getSeasonPath(competitionId: string, seasonId: string): Promise<PublicSeasonPath | null>
}
