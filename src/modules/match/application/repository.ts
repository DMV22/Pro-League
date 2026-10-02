import type { VersionedEntity } from '../../../shared/application/persistence'

export type FixtureRoundRecord = VersionedEntity & {
  stageId: string
  stageVersionId: string
  code: string
  position: number
}
export type MatchRecord = VersionedEntity & {
  fixtureSlotId: string
  stageId: string
  sportingState: string
  currentResultVersionId: string | null
}
export type MatchResultRecord = {
  id: string
  matchId: string
  versionNumber: number
  playedScoreVersionId: string | null
  technicalResultId: string | null
  confirmedAt: Date
}

export interface MatchRepository {
  findFixtureRound(id: string): Promise<FixtureRoundRecord | null>
  createFixtureRound(input: {
    id: string
    stageId: string
    stageVersionId: string
    code: string
    position: number
  }): Promise<FixtureRoundRecord>
  findMatch(id: string): Promise<MatchRecord | null>
  findCurrentResult(matchId: string): Promise<MatchResultRecord | null>
}
