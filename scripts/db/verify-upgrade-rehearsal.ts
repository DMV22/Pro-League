import assert from 'node:assert/strict'

import pg from 'pg'

import { assertCiDatabaseTarget } from './ci-database-target'
import { loadProjectEnv } from './load-env'
import { assertMigrationLedger, readMigrationManifest, type LedgerRow } from './migration-ledger'

loadProjectEnv()
const { url, database } = assertCiDatabaseTarget(
  process.env.MIGRATION_DATABASE_URL,
  'proleague_upgrade_ci',
)
assert.equal(database, 'proleague_upgrade_ci')
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 })
try {
  await client.connect()
  const ledger = await client.query<LedgerRow>(
    'SELECT hash, created_at::text FROM app.__drizzle_migrations ORDER BY created_at, id',
  )
  assertMigrationLedger(readMigrationManifest(), ledger.rows)
  const result = await client.query<{
    stage_current: string
    stage_mismatches: string
    round_current: string
    round_mismatches: string
    stage_duplicates: string
    round_duplicates: string
  }>(`
    SELECT
      (SELECT count(*) FROM app.stage_participant_slots WHERE current_assignment_id IS NOT NULL)
        AS stage_current,
      (SELECT count(*) FROM app.stage_participant_slots s
        JOIN app.stage_participant_assignments a ON a.id = s.current_assignment_id
        WHERE s.current_season_entry_id IS DISTINCT FROM a.season_entry_id) AS stage_mismatches,
      (SELECT count(*) FROM app.knockout_tie_participant_slots WHERE current_season_entry_id IS NOT NULL)
        AS round_current,
      (SELECT count(*) FROM app.knockout_tie_participant_slots s
        JOIN app.knockout_ties t ON t.id = s.tie_id
        WHERE s.round_id IS DISTINCT FROM t.round_id) AS round_mismatches,
      (SELECT count(*) FROM (
        SELECT stage_id, current_season_entry_id FROM app.stage_participant_slots
        WHERE current_season_entry_id IS NOT NULL
        GROUP BY stage_id, current_season_entry_id HAVING count(*) > 1
      ) duplicate) AS stage_duplicates,
      (SELECT count(*) FROM (
        SELECT round_id, current_season_entry_id FROM app.knockout_tie_participant_slots
        WHERE current_season_entry_id IS NOT NULL
        GROUP BY round_id, current_season_entry_id HAVING count(*) > 1
      ) duplicate) AS round_duplicates
  `)
  const row = result.rows[0]
  assert(row)
  assert(Number(row.stage_current) > 0, 'No current Stage assignments were upgraded')
  assert(Number(row.round_current) > 0, 'No current Knockout participants were upgraded')
  for (const field of [
    'stage_mismatches',
    'round_mismatches',
    'stage_duplicates',
    'round_duplicates',
  ] as const) {
    assert.equal(Number(row[field]), 0, `${field} after upgrade`)
  }
  console.info('Previous-release Golden Season upgrade verified without participant drift')
} finally {
  await client.end()
}
