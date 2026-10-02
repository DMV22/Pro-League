import { eq } from 'drizzle-orm'

import type { MatchRepository } from '../application/repository'
import type { DatabaseTransaction } from '../../../server/db/transaction-types'
import { fixtureRounds, matches, matchResultVersions } from './schema'

export function createMatchRepository(tx: DatabaseTransaction): MatchRepository {
  return {
    async findFixtureRound(id) {
      const [row] = await tx
        .select({
          id: fixtureRounds.id,
          version: fixtureRounds.version,
          stageId: fixtureRounds.stageId,
          stageVersionId: fixtureRounds.stageVersionId,
          code: fixtureRounds.code,
          position: fixtureRounds.position,
        })
        .from(fixtureRounds)
        .where(eq(fixtureRounds.id, id))
      return row ?? null
    },
    async createFixtureRound(input) {
      const [row] = await tx.insert(fixtureRounds).values(input).returning({
        id: fixtureRounds.id,
        version: fixtureRounds.version,
        stageId: fixtureRounds.stageId,
        stageVersionId: fixtureRounds.stageVersionId,
        code: fixtureRounds.code,
        position: fixtureRounds.position,
      })
      return row
    },
    async findMatch(id) {
      const [row] = await tx
        .select({
          id: matches.id,
          version: matches.version,
          fixtureSlotId: matches.fixtureSlotId,
          stageId: matches.stageId,
          sportingState: matches.sportingState,
          currentResultVersionId: matches.currentResultVersionId,
        })
        .from(matches)
        .where(eq(matches.id, id))
      return row ?? null
    },
    async findCurrentResult(matchId) {
      const [row] = await tx
        .select({
          id: matchResultVersions.id,
          matchId: matchResultVersions.matchId,
          versionNumber: matchResultVersions.versionNumber,
          playedScoreVersionId: matchResultVersions.playedScoreVersionId,
          technicalResultId: matchResultVersions.technicalResultId,
          confirmedAt: matchResultVersions.confirmedAt,
        })
        .from(matches)
        .innerJoin(matchResultVersions, eq(matches.currentResultVersionId, matchResultVersions.id))
        .where(eq(matches.id, matchId))
      return row ?? null
    },
  }
}
