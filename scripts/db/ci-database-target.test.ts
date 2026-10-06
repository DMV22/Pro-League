import { describe, expect, it } from 'vitest'

import { assertCiDatabaseTarget } from './ci-database-target'

describe('CI PostgreSQL target guard', () => {
  const url = 'postgresql://proleague:ci-only@127.0.0.1:5435/proleague_migration_ci'

  it('accepts a confirmed disposable target', () => {
    expect(assertCiDatabaseTarget(url, 'proleague_migration_ci').database).toBe(
      'proleague_migration_ci',
    )
  })

  it.each([
    [undefined, 'proleague_migration_ci'],
    [url, undefined],
    [url.replace('proleague_migration_ci', 'proleague'), 'proleague'],
    [url.replace('127.0.0.1', 'prod.example'), 'proleague_migration_ci'],
    [`${url}?host=prod.example`, 'proleague_migration_ci'],
  ] as const)('rejects unsafe target %#', (candidate, confirmation) => {
    expect(() => assertCiDatabaseTarget(candidate, confirmation)).toThrow()
  })
})
