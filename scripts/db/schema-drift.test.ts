import { describe, expect, it } from 'vitest'

import { assertSchemaMatches } from './schema-drift'

const dump = `-- PostgreSQL database dump
\\restrict RANDOMTOKEN
CREATE SCHEMA app;
CREATE TABLE app.__drizzle_migrations (id integer);
\\unrestrict RANDOMTOKEN
`

describe('read-only schema drift gate', () => {
  it('ignores only pg_dump session tokens', () => {
    expect(assertSchemaMatches(dump.replaceAll('RANDOMTOKEN', 'OTHER'), dump)).toMatch(
      /^[a-f0-9]{64}$/,
    )
  })

  it('rejects a changed table definition', () => {
    expect(() => assertSchemaMatches(dump, dump.replace('id integer', 'id bigint'))).toThrow(
      /Schema drift/,
    )
  })

  it('rejects a missing or empty schema dump', () => {
    expect(() => assertSchemaMatches(dump, '')).toThrow(/app schema/)
  })
})
