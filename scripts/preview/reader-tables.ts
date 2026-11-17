import assert from 'node:assert/strict'
import type pg from 'pg'

/** Only public read projections; never Admin, private data or the migration ledger. */
export const previewReaderTables = [
  'competitions',
  'competition_slugs',
  'seasons',
  'season_slugs',
  'competition_stages',
  'competition_stage_versions',
  'fixture_rounds',
  'league_fixture_slots',
  'match_participant_assignments',
  'matches',
  'match_result_versions',
  'match_schedule_revisions',
  'played_score_versions',
  'technical_results',
  'season_entries',
  'teams',
  'points_schemes',
  'ranking_rule_sets',
  'standing_adjustment_decisions',
  'stage_participant_slots',
  'stage_participant_assignments',
  'tie_breakers',
  'public_projection_revisions',
] as const

/** Technical read evidence only. In particular, no Outbox payload, actor or lease data. */
const cacheColumns = {
  cache_invalidation_intents: [
    'id',
    'semantic_target',
    'committed_version',
    'urgency',
    'state',
    'created_at',
  ],
  outbox_messages: ['id', 'state'],
} as const

/** Reviewed capability addition; never repair unexpected grants or rotate an existing identity. */
export async function grantPreviewReaderCacheAccess(
  client: Pick<pg.Client, 'query'>,
  role: string,
) {
  assert(/^[a-z_][a-z_0-9]{0,62}$/.test(role), 'Invalid reader role identifier')
  await verifyPreviewReaderCacheAccess(client, role, true)
  for (const [table, columns] of Object.entries(cacheColumns)) {
    await client.query(
      `GRANT SELECT (${columns.map((column) => `"${column}"`).join(',')}) ON app."${table}" TO "${role}"`,
    )
  }
  await verifyPreviewReaderCacheAccess(client, role)
}

/** Reject extra column reads and every column write, including grants invisible at table level. */
export async function verifyPreviewReaderCacheAccess(
  client: Pick<pg.Client, 'query'>,
  role: string,
  allowMissing = false,
) {
  const result = await client.query<{
    table_name: string
    column_name: string
    readable: boolean
    writable: boolean
    table_writable: boolean
  }>(
    `
    SELECT c.relname AS table_name, a.attname AS column_name,
      has_column_privilege($1,c.oid,a.attnum,'SELECT') AS readable,
      has_column_privilege($1,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES') AS writable,
      has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS table_writable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='app' AND c.relname IN ('cache_invalidation_intents','outbox_messages')`,
    [role],
  )
  const allowed = Object.entries(cacheColumns).flatMap(([table, columns]) =>
    columns.map((column) => `${table}.${column}`),
  )
  const present = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`))
  assert(
    allowed.every((column) => present.has(column)),
    'Cache evidence columns are missing',
  )
  assert(
    result.rows.every(
      (row) =>
        !row.writable &&
        !row.table_writable &&
        (allowed.includes(`${row.table_name}.${row.column_name}`)
          ? allowMissing || row.readable
          : !row.readable),
    ),
    'Reader cache column privileges differ; no automatic repair',
  )
}
