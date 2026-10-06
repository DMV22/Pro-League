import { describe, expect, it } from 'vitest'

import { PersistenceFailure } from '../../shared/application/persistence'
import { mapDatabaseFailure } from './failures'

describe('database failure mapping', () => {
  it.each([
    ['23505', 'conflict'],
    ['23P01', 'conflict'],
    ['23503', 'reference'],
    ['23514', 'constraint'],
    ['40001', 'retryable'],
    ['40P01', 'retryable'],
    ['ECONNREFUSED', 'unavailable'],
  ] as const)('maps %s to %s without vendor details', (code, kind) => {
    const result = mapDatabaseFailure({ code, detail: 'sensitive database detail' })
    expect(result).toBeInstanceOf(PersistenceFailure)
    expect((result as PersistenceFailure).kind).toBe(kind)
    expect(result.message).not.toContain('sensitive')
  })

  it('preserves application errors and typed conflicts', () => {
    const applicationError = new Error('A business rule failed')
    const conflict = new PersistenceFailure('conflict', 'Version is stale')
    expect(mapDatabaseFailure(applicationError)).toBe(applicationError)
    expect(mapDatabaseFailure(conflict)).toBe(conflict)
  })
})
