import 'server-only'

import pg from 'pg'

import { readDatabaseUrl } from './config'

const globalForDatabase = globalThis as typeof globalThis & {
  proLeagueRuntimePool?: pg.Pool
}

// Budget: warm Node instances × 5 must remain below the provider connection limit,
// leaving capacity for migrations, maintenance, and other consumers.
export const RUNTIME_POOL_MAX = 5

export function getRuntimePool(): pg.Pool {
  if (!globalForDatabase.proLeagueRuntimePool) {
    const pool = new pg.Pool({
      connectionString: readDatabaseUrl('DATABASE_URL'),
      max: RUNTIME_POOL_MAX,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    })

    pool.on('error', (error) => {
      console.error('Idle PostgreSQL connection failed', error.name)
    })

    globalForDatabase.proLeagueRuntimePool = pool
  }

  return globalForDatabase.proLeagueRuntimePool
}

export async function closeRuntimePool(): Promise<void> {
  const pool = globalForDatabase.proLeagueRuntimePool
  if (!pool) return
  globalForDatabase.proLeagueRuntimePool = undefined
  await pool.end()
}
