import assert from 'node:assert/strict'
import pg from 'pg'
import { loadProjectEnv } from './load-env'
import { assertMigrationLedger, readMigrationManifest, type LedgerRow } from './migration-ledger'
import { assertPreviewSqlIdentity, readPreviewOperationsTarget } from './preview-preflight'

loadProjectEnv()
const args = process.argv.slice(2)
assert(
  args.length === 2 &&
    args.every((arg) => /^--(preview-pr|confirm-db)=.+$/.test(arg)) &&
    new Set(args.map((arg) => arg.split('=')[0])).size === 2,
  'Specify only --preview-pr and --confirm-db',
)
const option = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const { connectionString, identity } = await readPreviewOperationsTarget(
  'MIGRATION_DATABASE_URL',
  option('confirm-db'),
  Number(option('preview-pr')),
)
const password = process.env.PREVIEW_RUNTIME_PASSWORD
assert(
  password && /^[A-Za-z0-9_-]{32,128}$/.test(password),
  'PREVIEW_RUNTIME_PASSWORD must be a private random 32–128 character base64url value',
)
const role = `preview_reader_pr_${identity.pullRequest}`
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,
})
// Only tables read by the M3 public projections; no Admin, personal data or ledger grants.
const tables = [
  'competitions',
  'competition_slugs',
  'seasons',
  'season_slugs',
  'competition_stages',
  'competition_stage_versions',
  'fixture_rounds',
  'league_fixture_slots',
  'match_participant_assignments',
  'matches',
  'match_result_versions',
  'match_schedule_revisions',
  'played_score_versions',
  'technical_results',
  'season_entries',
  'teams',
  'points_schemes',
  'ranking_rule_sets',
  'standing_adjustment_decisions',
  'stage_participant_slots',
  'stage_participant_assignments',
  'tie_breakers',
  'public_projection_revisions',
]
try {
  await client.connect()
  await assertPreviewSqlIdentity(client, identity)
  await client.query('BEGIN')
  await client.query("SET LOCAL lock_timeout = '5s'")
  const lock = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_xact_lock(749203, 95) AS locked',
  )
  assert(lock.rows[0]?.locked, 'Preview migration or identity provisioning is already running')
  const ledger = await client.query<LedgerRow>(
    'SELECT hash, created_at::text FROM app.__drizzle_migrations ORDER BY created_at, id',
  )
  assertMigrationLedger(readMigrationManifest(), ledger.rows)
  const existing = await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])
  assert(
    existing.rowCount === 0,
    'Reader already exists; do not silently rotate its password or reuse a different identity',
  )
  // Role is generated from a validated integer; password has a strict non-quoting alphabet.
  await client.query(
    `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
  )
  await client.query(`GRANT CONNECT ON DATABASE "${identity.database}" TO "${role}"`)
  await client.query(`GRANT USAGE ON SCHEMA app TO "${role}"`)
  await client.query(
    `GRANT SELECT ON ${tables.map((table) => `app."${table}"`).join(', ')} TO "${role}"`,
  )
  await client.query(`ALTER ROLE "${role}" SET default_transaction_read_only = on`)
  await client.query('COMMIT')
  console.info(
    `Read-only Preview login provisioned for PR ${identity.pullRequest}; no credential is printed`,
  )
} catch {
  await client.query('ROLLBACK').catch(() => undefined)
  throw new Error('Preview reader provisioning failed; inspect sanitized diagnostics')
} finally {
  await client.end()
}
