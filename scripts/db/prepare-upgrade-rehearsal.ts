import assert from 'node:assert/strict'

import pg from 'pg'

import { seedGoldenSeason } from './golden-season-fixture'
import { assertCiDatabaseTarget } from './ci-database-target'
import { loadProjectEnv } from './load-env'
import { readMigrationManifest } from './migration-ledger'

loadProjectEnv()
const { url, database } = assertCiDatabaseTarget(
  process.env.MIGRATION_DATABASE_URL,
  'proleague_upgrade_ci',
)
assert.equal(database, 'proleague_upgrade_ci')
const manifest = readMigrationManifest()
assert.deepEqual(
  manifest.map(({ tag }) => tag),
  ['0000_initial_proleague_schema', '0001_current_participant_uniqueness'],
  'Upgrade rehearsal needs an explicit update for a new release migration',
)

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 })
const client = await pool.connect()
try {
  const existing = await client.query<{ app: string | null }>(
    "SELECT to_regnamespace('app')::text AS app",
  )
  assert.equal(existing.rows[0]?.app, null, 'Upgrade rehearsal requires an empty database')

  await client.query('BEGIN')
  await client.query("SET LOCAL lock_timeout = '5s'")
  await client.query("SET LOCAL statement_timeout = '120s'")
  await client.query('CREATE SCHEMA app')
  await client.query(
    `CREATE TABLE app.__drizzle_migrations
      (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  )
  for (const statement of manifest[0].statements) {
    if (statement.trim()) await client.query(statement)
  }
  await client.query('INSERT INTO app.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
    manifest[0].hash,
    manifest[0].createdAt,
  ])
  await seedGoldenSeason(client)
  await client.query('COMMIT')
  console.info('Previous-release schema and Golden Season fixture prepared in proleague_upgrade_ci')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  client.release()
  await pool.end()
}
