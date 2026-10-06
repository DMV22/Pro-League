import pg from 'pg'

import {
  assertLocalDatabaseUrl,
  readDatabaseUrl,
  type DatabaseUrlName,
} from '../../src/server/db/config'
import { loadProjectEnv } from './load-env'

loadProjectEnv()

export function createLocalClient(name: DatabaseUrlName): pg.Client {
  const url = readDatabaseUrl(name)
  assertLocalDatabaseUrl(url, name)

  return new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5_000,
  })
}
