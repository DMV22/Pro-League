import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import {
  assertMigrationLedger,
  readMigrationManifest,
  type LedgerRow,
} from '../db/migration-ledger'
import { seedGoldenSeason } from '../db/golden-season-fixture'
import { assertPreviewDatabaseUrl, type PreviewIdentity } from '../../src/server/db/preview-target'
import { verifyGoldenInventory } from './fixture'
import { previewReaderTables } from './reader-tables'

export const goldenDigest = '356709a5a2fd1b8d430751f3d00a1e071d85f742d05f730cc0caec9cadc9c961'
const settings = {
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
  query_timeout: 125_000,
}

/** Session-only coordination on the verified empty parent; creates no schema/data. */
export async function withAllocationLease<T>(parentUrl: string, run: () => Promise<T>) {
  const client = new pg.Client({ connectionString: parentUrl, ...settings })
  try {
    await client.connect()
    const identity = await client.query<{ database: string; version: string }>(
      "SELECT current_database() AS database, current_setting('server_version_num') AS version",
    )
    assert(
      identity.rows[0].database === 'neondb' &&
        Number(identity.rows[0].version) >= 180000 &&
        Number(identity.rows[0].version) < 190000,
    )
    const tables = await client.query(
      "SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')",
    )
    assert(tables.rowCount === 0, 'Empty parent is not empty; stop all allocations')
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(749203,96) AS locked',
    )
    assert(lock.rows[0].locked, 'Allocation busy; retry explicitly')
    return await run()
  } finally {
    await client.end()
  }
}

export function readerUrl(identity: PreviewIdentity, password: string) {
  assert(/^[A-Za-z0-9_-]{32,128}$/.test(password))
  return assertPreviewDatabaseUrl(
    `postgresql://preview_reader_pr_${identity.pullRequest}:${password}@${identity.endpointId}-pooler.c-7.eu-central-1.aws.neon.tech/${identity.database}?sslmode=verify-full`,
    identity,
    'runtime',
  )
}

export async function prepareDatabase(
  identity: PreviewIdentity,
  ownerUrl: string,
  root: string,
  password: string,
) {
  assertPreviewDatabaseUrl(ownerUrl, identity, 'operations')
  assert(/^[A-Za-z0-9_-]{32,128}$/.test(password))
  const pool = new pg.Pool({ connectionString: ownerUrl, max: 1, ...settings })
  const client = await pool.connect()
  const marker = `proleague-preview/v1/${identity.projectId}/${identity.branchId}/${identity.pullRequest}`
  try {
    const actual = await client.query<{ database: string; version: string; marker: string | null }>(
      "SELECT current_database() AS database, current_setting('server_version_num') AS version, shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()), 'pg_database') AS marker",
    )
    assert(
      actual.rows[0].database === identity.database &&
        Number(actual.rows[0].version) >= 180000 &&
        Number(actual.rows[0].version) < 190000,
    )
    assert(
      !actual.rows[0].marker || actual.rows[0].marker === marker,
      'Database ownership marker differs',
    )
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(749203,95) AS locked',
    )
    assert(lock.rows[0].locked, 'Preview database is busy')
    const manifest = readMigrationManifest(root)
    const ledgerExists = await client.query<{ ledger: string | null }>(
      "SELECT to_regclass('app.__drizzle_migrations')::text AS ledger",
    )
    if (ledgerExists.rows[0].ledger) {
      const rows = await client.query<LedgerRow>(
        'SELECT hash,created_at::text FROM app.__drizzle_migrations ORDER BY created_at,id',
      )
      assertMigrationLedger(manifest.slice(0, rows.rows.length), rows.rows)
    } else {
      const inventory = await client.query(
        "SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')",
      )
      assert(inventory.rowCount === 0, 'New Preview database must be empty')
    }
    await client.query("SET lock_timeout = '5s'")
    await migrate(drizzle({ client }), {
      migrationsFolder: `${root}/drizzle`,
      migrationsSchema: 'app',
      migrationsTable: '__drizzle_migrations',
    })
    assertMigrationLedger(
      manifest,
      (
        await client.query<LedgerRow>(
          'SELECT hash,created_at::text FROM app.__drizzle_migrations ORDER BY created_at,id',
        )
      ).rows,
    )
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    const tables = (
      await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname='app' AND tablename NOT IN ('__drizzle_migrations','public_projection_revisions') ORDER BY tablename",
      )
    ).rows.map((row) => row.tablename)
    assert(tables.length >= 50)
    let populated = false
    for (const table of tables) {
      assert(/^[a-z_][a-z_0-9]*$/.test(table))
      if ((await client.query(`SELECT 1 FROM app."${table}" LIMIT 1`)).rowCount) populated = true
    }
    if (!populated) await seedGoldenSeason(client)
    await verifyGoldenInventory(client, tables)
    const stable = await client.query(
      "SELECT 'stage' AS kind,id::text,code AS relation FROM app.competition_stages UNION ALL SELECT 'match',id::text,sporting_state FROM app.matches UNION ALL SELECT 'entry',id::text,team_id::text FROM app.season_entries UNION ALL SELECT 'article',id::text,lifecycle_state FROM app.news_articles ORDER BY kind,id",
    )
    assert.equal(
      createHash('sha256').update(JSON.stringify(stable.rows)).digest('hex'),
      goldenDigest,
    )
    // Technical identity marker, not a second app schema/migration history.
    await client.query(`COMMENT ON DATABASE "${identity.database}" IS '${marker}'`)
    const role = `preview_reader_pr_${identity.pullRequest}`
    const existing = await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])
    if (!existing.rowCount) {
      await client.query(
        `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
      )
      await client.query(`GRANT CONNECT ON DATABASE "${identity.database}" TO "${role}"`)
      await client.query(`GRANT USAGE ON SCHEMA app TO "${role}"`)
      await client.query(
        `GRANT SELECT ON ${previewReaderTables.map((table) => `app."${table}"`).join(',')} TO "${role}"`,
      )
      await client.query(`ALTER ROLE "${role}" SET default_transaction_read_only=on`)
    }
    const attributes = await client.query<{ safe: boolean }>(
      'SELECT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AS safe FROM pg_roles WHERE rolname=$1',
      [role],
    )
    assert(attributes.rows[0].safe, 'Reader privileges differ; no silent role repair')
    const memberships = await client.query(
      'SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1',
      [role],
    )
    assert(memberships.rowCount === 0, 'Reader has unexpected memberships')
    await client.query('COMMIT')
    await verifyReader(identity, readerUrl(identity, password), marker)
  } catch {
    await client.query('ROLLBACK').catch(() => undefined)
    throw new Error(
      'Preview database preparation failed; no reset or credential rotation performed',
    )
  } finally {
    client.release()
    await pool.end()
  }
}

export async function verifyReader(
  identity: PreviewIdentity,
  url: string,
  marker = `proleague-preview/v1/${identity.projectId}/${identity.branchId}/${identity.pullRequest}`,
) {
  assertPreviewDatabaseUrl(url, identity, 'runtime')
  const client = new pg.Client({ connectionString: url, ...settings })
  try {
    await client.connect()
    const result = await client.query<{
      database: string
      role: string
      readonly: string
      marker: string
    }>(
      "SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS readonly,shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database') AS marker",
    )
    const row = result.rows[0]
    assert(
      row.database === identity.database &&
        row.role === `preview_reader_pr_${identity.pullRequest}` &&
        row.readonly === 'on' &&
        row.marker === marker,
    )
    const grants = await client.query<{ tablename: string; readable: boolean; writable: boolean }>(
      "SELECT tablename,has_table_privilege(current_user,format('app.%I',tablename),'SELECT') AS readable,has_table_privilege(current_user,format('app.%I',tablename),'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS writable FROM pg_tables WHERE schemaname='app'",
    )
    assert(
      grants.rows.every(
        (table) =>
          !table.writable &&
          table.readable === (previewReaderTables as readonly string[]).includes(table.tablename),
      ),
      'Reader table grants differ',
    )
    const schemas = await client.query(
      "SELECT 1 FROM pg_namespace WHERE nspname IN ('app','public') AND has_schema_privilege(current_user,oid,'CREATE')",
    )
    assert(schemas.rowCount === 0, 'Reader can create schema objects')
    const routines = await client.query(
      "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.prosecdef AND has_function_privilege(current_user,p.oid,'EXECUTE')",
    )
    assert(routines.rowCount === 0, 'Reader can execute security-definer routines')
  } finally {
    await client.end()
  }
}
