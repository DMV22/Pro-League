import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { assertLocalDatabaseUrl, readDatabaseUrl } from '../../src/server/db/config'
import { loadProjectEnv } from './load-env'

loadProjectEnv()

const url = readDatabaseUrl('MIGRATION_DATABASE_URL')
assertLocalDatabaseUrl(url, 'MIGRATION_DATABASE_URL')

const journalPath = resolve('drizzle/meta/_journal.json')

if (!existsSync(journalPath)) {
  throw new Error(
    'No reviewed migration exists yet. The first complete schema migration belongs to #72.',
  )
}

const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: unknown[] }

if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
  throw new Error('Migration journal is empty; refusing to apply an incomplete schema.')
}
