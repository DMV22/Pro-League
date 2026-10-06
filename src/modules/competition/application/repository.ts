import type { ExpectedVersion, VersionedEntity } from '../../../shared/application/persistence'

export type CompetitionRecord = VersionedEntity & { displayName: string }
export type SeasonRecord = VersionedEntity & {
  competitionId: string
  name: string
  timezone: string
}

export interface CompetitionRepository {
  findCompetition(id: string): Promise<CompetitionRecord | null>
  createCompetition(input: { id: string; displayName: string }): Promise<CompetitionRecord>
  renameCompetition(input: ExpectedVersion & { displayName: string }): Promise<CompetitionRecord>
  findSeason(id: string): Promise<SeasonRecord | null>
  createSeason(input: {
    id: string
    competitionId: string
    name: string
    timezone: string
  }): Promise<SeasonRecord>
  lockCompetitionAndSeason(input: {
    competitionId: string
    seasonId: string
  }): Promise<{ competition: CompetitionRecord; season: SeasonRecord }>
}
