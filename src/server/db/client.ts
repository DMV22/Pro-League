import 'server-only'

import { drizzle } from 'drizzle-orm/node-postgres'

import { getRuntimePool } from './pool'

let database: ReturnType<typeof drizzle> | undefined

export function getDatabase(): ReturnType<typeof drizzle> {
  database ??= drizzle({ client: getRuntimePool() })
  return database
}
