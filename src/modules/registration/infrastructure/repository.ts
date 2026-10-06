import { eq } from 'drizzle-orm'

import type { RegistrationRepository } from '../application/repository'
import type { DatabaseTransaction } from '../../../server/db/transaction-types'
import { seasonEntries, teams } from './schema'

export function createRegistrationRepository(tx: DatabaseTransaction): RegistrationRepository {
  return {
    async findTeam(id) {
      const [row] = await tx
        .select({ id: teams.id, version: teams.version, displayName: teams.displayName })
        .from(teams)
        .where(eq(teams.id, id))
      return row ?? null
    },
    async createTeam(input) {
      const [row] = await tx
        .insert(teams)
        .values(input)
        .returning({ id: teams.id, version: teams.version, displayName: teams.displayName })
      return row
    },
    async findSeasonEntry(id) {
      const [row] = await tx
        .select({
          id: seasonEntries.id,
          version: seasonEntries.version,
          seasonId: seasonEntries.seasonId,
          teamId: seasonEntries.teamId,
          approvedApplicationId: seasonEntries.approvedApplicationId,
        })
        .from(seasonEntries)
        .where(eq(seasonEntries.id, id))
      return row ?? null
    },
    async createSeasonEntry(input) {
      const [row] = await tx.insert(seasonEntries).values(input).returning({
        id: seasonEntries.id,
        version: seasonEntries.version,
        seasonId: seasonEntries.seasonId,
        teamId: seasonEntries.teamId,
        approvedApplicationId: seasonEntries.approvedApplicationId,
      })
      return row
    },
  }
}
