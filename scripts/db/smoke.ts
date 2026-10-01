import { createLocalClient } from './connect'

const client = createLocalClient('DATABASE_URL')

try {
  await client.connect()

  const result = await client.query<{ server_version_num: string; check: number }>(
    "SELECT current_setting('server_version_num') AS server_version_num, 1 AS check",
  )
  const version = Number(result.rows[0]?.server_version_num)

  if (result.rows[0]?.check !== 1 || version < 180000 || version >= 190000) {
    throw new Error('The local database must run PostgreSQL 18')
  }

  console.info(`Local PostgreSQL ${Math.floor(version / 10000)} connection passed`)
} catch (error) {
  console.error(
    'Local PostgreSQL connection failed:',
    error instanceof Error ? error.message : 'unknown error',
  )
  process.exitCode = 1
} finally {
  await client.end()
}
