import pg from 'pg'
import { loadProjectEnv } from './load-env'
import { assertM3AcceptanceTarget, prepareM3Acceptance } from './m3-acceptance-fixture'

loadProjectEnv()
const args = process.argv.slice(2)
if (args.length !== 1 || !args[0].startsWith('--confirm-db='))
  throw new Error(
    'Specify exactly --confirm-db=proleague_m3_acceptance_local|proleague_m3_acceptance_ci',
  )
const url = process.env.M3_ACCEPTANCE_DATABASE_URL
const database = assertM3AcceptanceTarget(url, args[0].slice('--confirm-db='.length))
const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 })
try {
  const client = await pool.connect()
  try {
    await prepareM3Acceptance(client, database)
    console.info(
      `Prepared isolated M3 acceptance fixture in ${database}; no shared fixture changed`,
    )
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}
