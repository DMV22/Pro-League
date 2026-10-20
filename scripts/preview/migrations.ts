import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { readMigrationManifest } from '../db/migration-ledger'

export function bundleDigest(files: Record<string, string>) {
  const names = Object.keys(files).sort()
  if (!names.length || names.length > 260) throw new Error('Unsafe migration bundle')
  const hash = createHash('sha256')
  let size = 0
  for (const name of names) {
    const content = files[name]
    const bytes = Buffer.byteLength(content)
    size += bytes
    if (
      !/^drizzle\/(?:\d{4}_[a-z0-9_]+\.sql|meta\/(?:_journal|\d{4}_snapshot)\.json)$/.test(name) ||
      !bytes ||
      bytes > 2 * 1024 * 1024 ||
      size > 16 * 1024 * 1024
    )
      throw new Error('Unsafe migration bundle')
    hash.update(`${name}\0${bytes}\0`).update(content).update('\0')
  }
  return hash.digest('hex')
}

export async function withMigrationBundle<T>(
  files: Record<string, string>,
  run: (root: string) => Promise<T>,
) {
  bundleDigest(files)
  const parent = resolve(tmpdir())
  const root = await mkdtemp(join(parent, 'proleague-preview-'))
  try {
    await mkdir(join(root, 'drizzle', 'meta'), { recursive: true })
    for (const [name, content] of Object.entries(files))
      await writeFile(join(root, name), content, { flag: 'wx', mode: 0o600 })
    const manifest = readMigrationManifest(root)
    const expected = [
      'drizzle/meta/_journal.json',
      ...manifest.flatMap((entry) => [
        `drizzle/${entry.tag}.sql`,
        `drizzle/meta/${entry.tag.slice(0, 4)}_snapshot.json`,
      ]),
    ].sort()
    if (JSON.stringify(Object.keys(files).sort()) !== JSON.stringify(expected))
      throw new Error('Unexpected migration files')
    return await run(root)
  } finally {
    // Only the exact directory created by mkdtemp above; never a caller-supplied path.
    if (dirname(resolve(root)) !== parent || !basename(root).startsWith('proleague-preview-'))
      throw new Error('Unsafe temporary migration cleanup target')
    await rm(root, { recursive: true, force: true })
  }
}
