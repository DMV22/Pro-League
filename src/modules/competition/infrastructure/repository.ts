import { and, eq, sql } from 'drizzle-orm'

import type { CompetitionRepository } from '../application/repository'
import { PersistenceFailure } from '../../../shared/application/persistence'
import type { DatabaseTransaction } from '../../../server/db/transaction-types'
import { competitions, seasons } from './schema'

export function createCompetitionRepository(tx: DatabaseTransaction): CompetitionRepository {
  return {
    async findCompetition(id) {
      const [row] = await tx
        .select({
          id: competitions.id,
          version: competitions.version,
          displayName: competitions.displayName,
        })
        .from(competitions)
        .where(eq(competitions.id, id))
      return row ?? null
    },
    async createCompetition(input) {
      const [row] = await tx.insert(competitions).values(input).returning({
        id: competitions.id,
        version: competitions.version,
        displayName: competitions.displayName,
      })
      return row
    },
    async renameCompetition({ id, expectedVersion, displayName }) {
      const [row] = await tx
        .update(competitions)
        .set({ displayName, version: sql`${competitions.version} + 1`, updatedAt: new Date() })
        .where(and(eq(competitions.id, id), eq(competitions.version, expectedVersion)))
        .returning({
          id: competitions.id,
          version: competitions.version,
          displayName: competitions.displayName,
        })
      if (!row)
        throw new PersistenceFailure('conflict', 'Competition version is stale or unavailable')
      return row
    },
    async findSeason(id) {
      const [row] = await tx
        .select({
          id: seasons.id,
          version: seasons.version,
          competitionId: seasons.competitionId,
          name: seasons.name,
          timezone: seasons.timezone,
        })
        .from(seasons)
        .where(eq(seasons.id, id))
      return row ?? null
    },
    async createSeason(input) {
      const [row] = await tx.insert(seasons).values(input).returning({
        id: seasons.id,
        version: seasons.version,
        competitionId: seasons.competitionId,
        name: seasons.name,
        timezone: seasons.timezone,
      })
      return row
    },
    async lockCompetitionAndSeason({ competitionId, seasonId }) {
      // Parent then child is the shared lock order for Current Season operations.
      const [competition] = await tx
        .select({
          id: competitions.id,
          version: competitions.version,
          displayName: competitions.displayName,
        })
        .from(competitions)
        .where(eq(competitions.id, competitionId))
        .for('update')
      const [season] = await tx
        .select({
          id: seasons.id,
          version: seasons.version,
          competitionId: seasons.competitionId,
          name: seasons.name,
          timezone: seasons.timezone,
        })
        .from(seasons)
        .where(and(eq(seasons.id, seasonId), eq(seasons.competitionId, competitionId)))
        .for('update')
      if (!competition || !season) {
        throw new PersistenceFailure('reference', 'Competition or its Season is unavailable')
      }
      return { competition, season }
    },
  }
}
