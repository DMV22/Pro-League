import pg from 'pg'

import { seedGoldenSeason } from './golden-season-fixture'
import { assertGoldenSeasonTarget, type GoldenSeasonTarget } from './golden-season-target'
import { loadProjectEnv } from './load-env'

loadProjectEnv()

function option(name: string): string | undefined {
  const match = process.argv.slice(2).find((argument) => argument.startsWith(`--${name}=`))
  return match?.slice(name.length + 3)
}

const target = option('target')
if (target !== 'local' && target !== 'ci' && target !== 'preview') {
  throw new Error('Specify --target=local|ci|preview')
}

const allowedArguments = new Set(['--reset'])
for (const argument of process.argv.slice(2)) {
  if (
    !allowedArguments.has(argument) &&
    !['--target=', '--confirm-db=', '--preview-pr='].some((prefix) => argument.startsWith(prefix))
  ) {
    throw new Error(`Unknown Golden Season argument: ${argument}`)
  }
}

const reset = process.argv.includes('--reset')
const previewPullRequest = option('preview-pr') ? Number(option('preview-pr')) : undefined
const url = process.env.SEED_DATABASE_URL
const database = assertGoldenSeasonTarget(
  url,
  target as GoldenSeasonTarget,
  option('confirm-db'),
  previewPullRequest,
)

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 })
const client = await pool.connect()
const tableName = (name: string) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(name)) throw new Error('Unexpected app table name')
  return `app."${name}"`
}

try {
  await client.query('begin isolation level serializable')
  await client.query("set local lock_timeout = '5s'")
  await client.query("set local statement_timeout = '120s'")
  await client.query('select pg_advisory_xact_lock(749203, 75)')

  const identity = await client.query<{ database: string; schema: string | null }>(
    "select current_database() as database, to_regnamespace('app')::text as schema",
  )
  if (identity.rows[0]?.database !== database || !identity.rows[0]?.schema) {
    throw new Error('Database identity or reviewed app migration does not match seed target')
  }
  const tables = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'app' and tablename <> '__drizzle_migrations' order by tablename",
  )
  if (tables.rows.length < 50 || !tables.rows.some((row) => row.tablename === 'competitions')) {
    throw new Error('The complete reviewed app schema must be migrated before seeding')
  }

  if (reset) {
    // Immutable-history triggers deliberately forbid TRUNCATE. They are disabled only
    // within this transaction on a database whose exact disposable identity passed above.
    for (const { tablename } of tables.rows) {
      await client.query(`alter table ${tableName(tablename)} disable trigger user`)
    }
    await client.query(
      `truncate table ${tables.rows.map(({ tablename }) => tableName(tablename)).join(', ')} restart identity cascade`,
    )
    for (const { tablename } of tables.rows) {
      await client.query(`alter table ${tableName(tablename)} enable trigger user`)
    }
  } else {
    for (const { tablename } of tables.rows) {
      const populated = await client.query(`select 1 from ${tableName(tablename)} limit 1`)
      if (populated.rowCount) {
        throw new Error('Dedicated seed database is not empty; use --reset to replace all app data')
      }
    }
  }

  await seedGoldenSeason(client)
  await client.query('commit')
  process.stdout.write(`Golden Season installed in disposable ${target} database ${database}.\n`)
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  client.release()
  await pool.end()
}
