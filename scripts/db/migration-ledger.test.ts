import { describe, expect, it } from 'vitest'

import { assertMigrationLedger, readMigrationManifest } from './migration-ledger'

describe('migration ledger', () => {
  const manifest = readMigrationManifest()
  const rows = manifest.map((migration) => ({
    hash: migration.hash,
    created_at: String(migration.createdAt),
  }))

  it('matches the committed migration SQL and journal', () => {
    expect(() => assertMigrationLedger(manifest, rows)).not.toThrow()
  })

  it('rejects a missing migration', () => {
    expect(() => assertMigrationLedger(manifest, rows.slice(0, -1))).toThrow(/count/)
  })

  it('rejects modified SQL hashes', () => {
    const altered = rows.map((row) => ({ ...row }))
    altered[0].hash = '0'.repeat(64)
    expect(() => assertMigrationLedger(manifest, altered)).toThrow(/hash/)
  })
})
