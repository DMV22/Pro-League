import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export function normalizeSchemaDump(dump: string): string {
  const normalized = dump
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !/^\\(?:un)?restrict [A-Za-z0-9]+$/.test(line))
    .join('\n')
    .trimEnd()

  assert(normalized.includes('CREATE SCHEMA app;'), 'Schema dump does not contain app schema')
  assert(
    normalized.includes('CREATE TABLE app.__drizzle_migrations'),
    'Migration ledger missing from dump',
  )
  return normalized
}

export function assertSchemaMatches(referenceDump: string, actualDump: string): string {
  const reference = normalizeSchemaDump(referenceDump)
  const actual = normalizeSchemaDump(actualDump)
  if (reference !== actual) {
    const expectedLines = reference.split('\n')
    const actualLines = actual.split('\n')
    const firstDifference = expectedLines.findIndex((line, index) => line !== actualLines[index])
    throw new Error(
      `Schema drift at normalized line ${firstDifference + 1}: expected ${JSON.stringify(expectedLines[firstDifference] ?? '')}, received ${JSON.stringify(actualLines[firstDifference] ?? '')}`,
    )
  }
  return createHash('sha256').update(actual).digest('hex')
}
