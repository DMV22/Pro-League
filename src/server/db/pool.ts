import 'server-only'

import pg from 'pg'

import { readDatabaseUrl } from './config'

const globalForDatabase = globalThis as typeof globalThis & {
  proLeagueRuntimePool?: pg.Pool
}

export function getRuntimePool(): pg.Pool {
  if (!globalForDatabase.proLeagueRuntimePool) {
    const pool = new pg.Pool({
      connectionString: readDatabaseUrl('DATABASE_URL'),
      max: 5,
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
