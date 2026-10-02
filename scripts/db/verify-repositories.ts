import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { assertLocalDatabaseUrl, readDatabaseUrl } from '../../src/server/db/config'
import { createTransactionAdapter } from '../../src/server/db/transaction'
import { PersistenceFailure } from '../../src/shared/application/persistence'
import { loadProjectEnv } from './load-env'

loadProjectEnv()
const url = readDatabaseUrl('DATABASE_URL')
assertLocalDatabaseUrl(url, 'DATABASE_URL')

const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 5_000 })
const transaction = createTransactionAdapter(drizzle({ client: pool }))

async function verifyRollback(): Promise<void> {
  const competitionId = randomUUID()
  const seasonId = randomUUID()
  const teamId = randomUUID()

  await assert.rejects(
    transaction.run(async ({ competition, registration }) => {
      await competition.createCompetition({ id: competitionId, displayName: 'Rollback test' })
      await competition.createSeason({
        id: seasonId,
        competitionId,
        name: 'Synthetic season',
        timezone: 'Europe/Kyiv',
      })
      const locked = await competition.lockCompetitionAndSeason({ competitionId, seasonId })
      assert.equal(locked.season.competitionId, locked.competition.id)
      await registration.createTeam({ id: teamId, displayName: 'Rollback team' })
      throw new Error('Synthetic failure after both module writes')
    }),
    /Synthetic failure after both module writes/,
  )

  await transaction.run(async ({ competition, registration }) => {
    assert.equal(await competition.findCompetition(competitionId), null)
    assert.equal(await competition.findSeason(seasonId), null)
    assert.equal(await registration.findTeam(teamId), null)
  })
}

async function verifyOptimisticConflict(): Promise<void> {
  const competitionId = randomUUID()

  await assert.rejects(
    transaction.run(async ({ competition }) => {
      const created = await competition.createCompetition({
        id: competitionId,
        displayName: 'Original',
      })
      const renamed = await competition.renameCompetition({
        id: competitionId,
        expectedVersion: created.version,
        displayName: 'Updated',
      })
      assert.equal(renamed.version, created.version + 1n)
      await competition.renameCompetition({
        id: competitionId,
        expectedVersion: created.version,
        displayName: 'Stale overwrite',
      })
    }),
    (error: unknown) => error instanceof PersistenceFailure && error.kind === 'conflict',
  )

  await transaction.run(async ({ competition }) => {
    assert.equal(await competition.findCompetition(competitionId), null)
  })
}

async function verifyRepresentativeReads(): Promise<void> {
  const absentId = randomUUID()
  await transaction.run(async ({ competition, registration, match }) => {
    assert.equal(await competition.findSeason(absentId), null)
    assert.equal(await registration.findSeasonEntry(absentId), null)
    assert.equal(await match.findFixtureRound(absentId), null)
    assert.equal(await match.findMatch(absentId), null)
    assert.equal(await match.findCurrentResult(absentId), null)
  })
}

try {
  const schema = await pool.query<{ table_name: string | null }>(
    "select to_regclass('app.competitions')::text as table_name",
  )
  if (!schema.rows[0]?.table_name) {
    throw new Error('Apply the initial migration to DATABASE_URL before repository verification')
  }
  await verifyRollback()
  await verifyOptimisticConflict()
  await verifyRepresentativeReads()
  console.log('Repository transaction, rollback, and optimistic-conflict checks passed')
} finally {
  await pool.end()
}
