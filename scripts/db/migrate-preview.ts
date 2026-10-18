import assert from 'node:assert/strict'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { loadProjectEnv } from './load-env'
import { assertMigrationLedger, readMigrationManifest, type LedgerRow } from './migration-ledger'
import { assertPreviewSqlIdentity, readPreviewOperationsTarget } from './preview-preflight'

loadProjectEnv()
const argumentsList = process.argv.slice(2)
assert(
  argumentsList.length === 2 && new Set(argumentsList.map((arg) => arg.split('=')[0])).size === 2,
  'Specify only --preview-pr=<number> and --confirm-db=<database>',
)
assert(
  argumentsList.every((arg) => /^--(preview-pr|confirm-db)=.+$/.test(arg)),
  'Unknown Preview migration argument',
)
const option = (name: string) =>
  argumentsList.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const manifest = readMigrationManifest()
const { connectionString, identity } = await readPreviewOperationsTarget(
  'MIGRATION_DATABASE_URL',
  option('confirm-db'),
  Number(option('preview-pr')),
)
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
  query_timeout: 125_000,
})
try {
  await client.connect()
  await assertPreviewSqlIdentity(client, identity)
  const lock = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(749203, 95) AS locked',
  )
  assert(lock.rows[0]?.locked, 'Another Preview migration is running; retry after it completes')
  await client.query("SET lock_timeout = '5s'")
  const ledgerExists = await client.query<{ ledger: string | null }>(
    "SELECT to_regclass('app.__drizzle_migrations')::text AS ledger",
  )
  if (ledgerExists.rows[0]?.ledger) {
    const previous = await client.query<LedgerRow>(
      'SELECT hash, created_at::text FROM app.__drizzle_migrations ORDER BY created_at, id',
    )
    assertMigrationLedger(manifest.slice(0, previous.rows.length), previous.rows)
  } else {
    const inventory = await client.query<{ count: string }>(
      "SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')",
    )
    assert(
      inventory.rows[0]?.count === '0',
      'Initial Preview installation requires an empty database',
    )
  }
  await migrate(drizzle({ client }), {
    migrationsFolder: 'drizzle',
    migrationsSchema: 'app',
    migrationsTable: '__drizzle_migrations',
  })
  const applied = await client.query<LedgerRow>(
    'SELECT hash, created_at::text FROM app.__drizzle_migrations ORDER BY created_at, id',
  )
  assertMigrationLedger(manifest, applied.rows)
  console.info(`Reviewed migrations verified in isolated Preview database ${identity.database}`)
} catch {
  // Provider/SQL errors can include URLs, SQL and credentials. Do not dump them.
  throw new Error(
    'Preview migration failed; inspect sanitized provider diagnostics and do not reset the database',
  )
} finally {
  // Closing the direct session releases its advisory lock even after a failure.
  await client.end()
}
