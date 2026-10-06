import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type JournalEntry = { idx: number; when: number; tag: string; version: string }
type Journal = { version: string; dialect: string; entries: JournalEntry[] }
type Snapshot = { id: string; prevId: string; version: string; dialect: string }
export type LedgerRow = { hash: string; created_at: string }

export function readMigrationManifest(root = process.cwd()) {
  const journal = JSON.parse(
    readFileSync(resolve(root, 'drizzle/meta/_journal.json'), 'utf8'),
  ) as Journal
  assert.equal(journal.dialect, 'postgresql')
  assert(journal.entries.length > 0, 'Migration journal must not be empty')

  let previousId = '00000000-0000-0000-0000-000000000000'
  let previousWhen = 0
  return journal.entries.map((entry, index) => {
    assert.equal(entry.idx, index, `Migration index ${index} is missing or reordered`)
    assert.match(entry.tag, /^\d{4}_[a-z0-9_]+$/)
    assert(entry.when > previousWhen, 'Migration timestamps must increase')
    previousWhen = entry.when

    const snapshot = JSON.parse(
      readFileSync(resolve(root, `drizzle/meta/${entry.tag.slice(0, 4)}_snapshot.json`), 'utf8'),
    ) as Snapshot
    assert.equal(snapshot.prevId, previousId, `${entry.tag} snapshot chain is broken`)
    assert.equal(snapshot.dialect, journal.dialect)
    assert.equal(snapshot.version, entry.version)
    previousId = snapshot.id

    const content = readFileSync(resolve(root, `drizzle/${entry.tag}.sql`), 'utf8')
    assert(content.trim().length > 0, `${entry.tag} has empty SQL`)
    return {
      tag: entry.tag,
      createdAt: entry.when,
      hash: createHash('sha256').update(content).digest('hex'),
      statements: content.split('--> statement-breakpoint'),
    }
  })
}

export function assertMigrationLedger(
  manifest: ReturnType<typeof readMigrationManifest>,
  rows: LedgerRow[],
): void {
  assert.equal(rows.length, manifest.length, 'Migration ledger count does not match journal')
  for (const [index, expected] of manifest.entries()) {
    const row = rows[index]
    assert.equal(
      row?.created_at,
      String(expected.createdAt),
      `${expected.tag} ledger timestamp differs`,
    )
    assert.equal(row?.hash, expected.hash, `${expected.tag} ledger SQL hash differs`)
  }
}
