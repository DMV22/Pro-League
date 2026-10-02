import type { VersionedEntity } from '../../../shared/application/persistence'

export type TeamRecord = VersionedEntity & { displayName: string }
export type SeasonEntryRecord = VersionedEntity & {
  seasonId: string
  teamId: string
  approvedApplicationId: string
}

export interface RegistrationRepository {
  findTeam(id: string): Promise<TeamRecord | null>
  createTeam(input: { id: string; displayName: string }): Promise<TeamRecord>
  findSeasonEntry(id: string): Promise<SeasonEntryRecord | null>
  createSeasonEntry(input: {
    id: string
    seasonId: string
    teamId: string
    approvedApplicationId: string
  }): Promise<SeasonEntryRecord>
}
