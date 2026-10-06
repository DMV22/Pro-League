import { readFileSync } from 'node:fs'

import { assertSchemaMatches } from './schema-drift'

const [referencePath, actualPath] = process.argv.slice(2)
if (!referencePath || !actualPath || process.argv.length !== 4) {
  throw new Error('Usage: pnpm db:compare-schema <reference.sql> <actual.sql>')
}
const digest = assertSchemaMatches(
  readFileSync(referencePath, 'utf8'),
  readFileSync(actualPath, 'utf8'),
)
console.info(`Schema-only PostgreSQL 18 dumps match; normalized digest: ${digest}`)
