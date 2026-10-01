import { createLocalClient } from './connect'

const client = createLocalClient('MIGRATION_DATABASE_URL')

try {
  await client.connect()

  const relation = await client.query<{ name: string | null }>(
    "SELECT to_regclass('app.__drizzle_migrations')::text AS name",
  )

  if (!relation.rows[0]?.name) {
    console.info(
      'Migration history is not initialized; the initial schema migration belongs to #72',
    )
  } else {
    const history = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM app.__drizzle_migrations',
    )
    console.info(`Applied migrations: ${history.rows[0]?.count ?? 'unknown'}`)
  }
} catch (error) {
  console.error(
    'Migration status failed:',
    error instanceof Error ? error.message : 'unknown error',
  )
  process.exitCode = 1
} finally {
  await client.end()
}
