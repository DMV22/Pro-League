import assert from 'node:assert/strict'

import pg from 'pg'

import { assertCiDatabaseTarget } from './ci-database-target'
import { loadProjectEnv } from './load-env'
import { assertMigrationLedger, readMigrationManifest, type LedgerRow } from './migration-ledger'

loadProjectEnv()
const confirmation = process.argv
  .find((arg) => arg.startsWith('--confirm-db='))
  ?.slice('--confirm-db='.length)
const { url, database } = assertCiDatabaseTarget(process.env.MIGRATION_DATABASE_URL, confirmation)
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 })

try {
  await client.connect()
  const version = await client.query<{ server_version_num: string }>('SHOW server_version_num')
  assert.equal(Math.floor(Number(version.rows[0]?.server_version_num) / 10_000), 18)
  const identity = await client.query<{ name: string }>('SELECT current_database() AS name')
  assert.equal(identity.rows[0]?.name, database)

  const rows = await client.query<LedgerRow>(
    'SELECT hash, created_at::text FROM app.__drizzle_migrations ORDER BY created_at, id',
  )
  const manifest = readMigrationManifest()
  assertMigrationLedger(manifest, rows.rows)
  console.info(`Migration ledger verified in ${database}: ${manifest.length} reviewed migrations`)
} finally {
  await client.end()
}
