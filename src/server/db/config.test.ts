import { describe, expect, it } from 'vitest'

import { assertLocalDatabaseUrl, readDatabaseUrl } from './config'

const localUrl = 'postgresql://proleague:private@127.0.0.1:5432/proleague'

describe('database URL configuration', () => {
  it('requires a configured URL without revealing its value', () => {
    expect(() => readDatabaseUrl('DATABASE_URL', {})).toThrow(
      'DATABASE_URL must be configured with a private database URL',
    )
    expect(() =>
      readDatabaseUrl('DATABASE_URL', {
        DATABASE_URL: 'postgresql://proleague:replace-with-a-private-local-password@localhost/db',
      }),
    ).toThrow('DATABASE_URL must be configured with a private database URL')
  })

  it('accepts a PostgreSQL URL with host, user, and database', () => {
    expect(readDatabaseUrl('DATABASE_URL', { DATABASE_URL: localUrl })).toBe(localUrl)
  })

  it.each([
    'https://proleague:private@localhost/proleague',
    'postgresql://localhost/proleague',
    'postgresql://proleague:private@localhost',
  ])('rejects an incomplete or non-PostgreSQL URL', (value) => {
    expect(() =>
      readDatabaseUrl('MIGRATION_DATABASE_URL', { MIGRATION_DATABASE_URL: value }),
    ).toThrow('MIGRATION_DATABASE_URL must include a PostgreSQL host, user, and database')
  })

  it('keeps local-only commands away from remote databases', () => {
    expect(() => assertLocalDatabaseUrl(localUrl, 'DATABASE_URL')).not.toThrow()
    expect(() =>
      assertLocalDatabaseUrl(
        'postgresql://proleague:private@database.example.com/proleague',
        'MIGRATION_DATABASE_URL',
      ),
    ).toThrow('MIGRATION_DATABASE_URL must point to a local PostgreSQL host for this command')
  })
})
