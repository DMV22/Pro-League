import 'server-only'

import { drizzle } from 'drizzle-orm/node-postgres'

import { getRuntimePool } from './pool'

let database: ReturnType<typeof drizzle> | undefined

export function getDatabase(): ReturnType<typeof drizzle> {
  // Check isolation even when the process already has an initialized client.
  const pool = getRuntimePool()
  database ??= drizzle({ client: pool })
  return database
}
