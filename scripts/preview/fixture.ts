import type pg from 'pg'
import { seedGoldenSeason } from '../db/golden-season-fixture'

/** Derive expected fields from trusted fixture code, never from a PR or the target DB. */
export async function goldenInventory() {
  const inventory = new Map<string, Map<string, Record<string, unknown>>>()
  await seedGoldenSeason({
    query: async (sql: string, parameters: unknown[]) => {
      const insert = /^insert into app\."([a-z_0-9]+)" \(([^)]+)\) values /.exec(sql)
      const update = /^update app\."([a-z_0-9]+)" set (.+) where id = \$\d+$/.exec(sql)
      if (insert) {
        const table = inventory.get(insert[1]) ?? new Map<string, Record<string, unknown>>()
        const columns = [...insert[2].matchAll(/"([a-z_0-9]+)"/g)].map((match) => match[1])
        const row = Object.fromEntries(columns.map((column, index) => [column, parameters[index]]))
        if (typeof row.id !== 'string' || table.has(row.id))
          throw new Error('Invalid trusted fixture')
        table.set(row.id, row)
        inventory.set(insert[1], table)
      } else if (update) {
        const columns = [...update[2].matchAll(/"([a-z_0-9]+)" = \$\d+/g)].map((match) => match[1])
        const row = inventory.get(update[1])?.get(String(parameters.at(-1)))
        if (!row) throw new Error('Unknown trusted fixture update')
        columns.forEach((column, index) => {
          row[column] = parameters[index]
        })
      } else throw new Error('Unsupported trusted fixture statement')
    },
  } as unknown as pg.PoolClient)
  return inventory
}

export async function verifyGoldenInventory(
  client: Pick<pg.PoolClient, 'query'>,
  tables: string[],
) {
  const expected = await goldenInventory()
  if ([...expected.keys()].some((name) => !tables.includes(name)))
    throw new Error('Golden fixture tables missing')
  for (const name of tables) {
    if (!/^[a-z_][a-z_0-9]*$/.test(name)) throw new Error('Unsafe table name')
    const rows = expected.get(name) ?? new Map<string, Record<string, unknown>>()
    const count = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM app."${name}"`,
    )
    if (Number(count.rows[0].count) !== rows.size)
      throw new Error('Golden inventory differs; no automatic reset')
    for (const row of rows.values()) {
      const fields = Object.keys(row)
      const found = await client.query(
        `SELECT 1 FROM app."${name}" WHERE ${fields.map((field, index) => `"${field}" IS NOT DISTINCT FROM $${index + 1}`).join(' AND ')}`,
        Object.values(row),
      )
      if (found.rowCount !== 1) throw new Error('Golden fixture fields differ; no automatic reset')
    }
  }
}
