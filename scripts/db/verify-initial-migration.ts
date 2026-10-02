import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createLocalClient } from './connect'

const client = createLocalClient('MIGRATION_DATABASE_URL')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function expectFailure(
  label: string,
  statements: Array<{ text: string; values?: unknown[] }>,
  expectedCode: string,
): Promise<void> {
  await client.query('SAVEPOINT negative_check')
  let observedCode: string | undefined

  try {
    for (const statement of statements) {
      await client.query(statement.text, statement.values)
    }
  } catch (error) {
    observedCode = (error as { code?: string }).code
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT negative_check')
    await client.query('RELEASE SAVEPOINT negative_check')
  }

  assert(
    observedCode === expectedCode,
    `${label}: expected ${expectedCode}, received ${observedCode}`,
  )
}

try {
  await client.connect()

  const inventory = await client.query<{
    table_count: string
    ledger_count: string
    owner_pointer_count: string
    immutable_trigger_count: string
    exclusion_count: string
    public_private_read: boolean
    app_audit_update: boolean
    app_audit_insert: boolean
    runtime_ledger_insert: boolean
  }>(`
    SELECT
      (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'app'
        AND table_type = 'BASE TABLE' AND table_name <> '__drizzle_migrations') AS table_count,
      (SELECT count(*) FROM app.__drizzle_migrations) AS ledger_count,
      (SELECT count(*) FROM pg_constraint WHERE connamespace = 'app'::regnamespace
        AND conname LIKE 'owner_pointer_%') AS owner_pointer_count,
      (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relnamespace = 'app'::regnamespace AND t.tgname LIKE '%_immutable')
        AS immutable_trigger_count,
      (SELECT count(*) FROM pg_constraint WHERE connamespace = 'app'::regnamespace
        AND contype = 'x') AS exclusion_count,
      has_table_privilege('app_public_reader', 'app.player_private_details', 'SELECT')
        AS public_private_read,
      has_table_privilege('app_runtime', 'app.audit_events', 'UPDATE')
        AS app_audit_update,
      has_table_privilege('app_runtime', 'app.audit_events', 'INSERT')
        AS app_audit_insert,
      has_table_privilege('app_runtime', 'app.__drizzle_migrations', 'INSERT')
        AS runtime_ledger_insert
  `)
  const row = inventory.rows[0]
  assert(row, 'Migration inventory is empty')
  assert(Number(row.table_count) === 210, 'Expected all 210 domain tables')
  assert(Number(row.ledger_count) === 1, 'Expected one applied migration')
  assert(Number(row.owner_pointer_count) === 37, 'Expected 37 direct owner-pointer FKs')
  assert(Number(row.immutable_trigger_count) === 125, 'Expected 125 immutable-table guards')
  assert(Number(row.exclusion_count) === 2, 'Expected both GiST range exclusions')
  assert(!row.public_private_read, 'Public role can read private details')
  assert(!row.app_audit_update && row.app_audit_insert, 'Audit grants are not append-only')
  assert(!row.runtime_ledger_insert, 'Runtime can mutate the migration ledger')

  const installedTables = new Set(
    (
      await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'app' AND table_type = 'BASE TABLE'`,
      )
    ).rows.map(({ table_name }) => table_name),
  )
  const blueprint = readFileSync('docs/architecture/relational-schema.md', 'utf8')
  const blueprintTables = [
    ...blueprint
      .slice(0, blueprint.indexOf('## Access and PII matrix'))
      .matchAll(/^\| `([a-z_]+)` \|/gm),
  ].map((match) => match[1])
  const missingTables = blueprintTables.filter((name) => !installedTables.has(name))
  assert(missingTables.length === 0, `Blueprint tables missing: ${missingTables.join(', ')}`)

  await client.query('BEGIN')
  const competitionA = randomUUID()
  const competitionB = randomUUID()
  const slugB = randomUUID()

  await client.query('INSERT INTO app.competitions (id, display_name) VALUES ($1, $2), ($3, $4)', [
    competitionA,
    'Migration Test A',
    competitionB,
    'Migration Test B',
  ])
  await client.query(
    `INSERT INTO app.competition_slugs
      (id, competition_id, display_slug, normalized_slug, valid_from_at)
      VALUES ($1, $2, $3, $4, now())`,
    [slugB, competitionB, 'migration-test-b', 'migration-test-b'],
  )

  await expectFailure(
    'Named state check',
    [
      {
        text: 'UPDATE app.competitions SET visibility = $1 WHERE id = $2',
        values: ['unknown', competitionA],
      },
    ],
    '23514',
  )
  await expectFailure(
    'Immutable slug history',
    [
      {
        text: 'UPDATE app.competition_slugs SET display_slug = $1 WHERE id = $2',
        values: ['changed', slugB],
      },
    ],
    '55000',
  )
  await expectFailure(
    'Current slug belongs to its owner',
    [
      {
        text: 'UPDATE app.competitions SET current_slug_id = $1 WHERE id = $2',
        values: [slugB, competitionA],
      },
      { text: 'SET CONSTRAINTS ALL IMMEDIATE' },
    ],
    '23503',
  )

  const season = randomUUID()
  const stage = randomUUID()
  const team = randomUUID()
  const application = randomUUID()
  const entry = randomUUID()
  const roster = randomUUID()
  const player = randomUUID()
  const rosterEntry = randomUUID()
  await client.query(
    `INSERT INTO app.seasons (id, competition_id, name, timezone)
      VALUES ($1, $2, 'Migration Test Season', 'Europe/Kyiv')`,
    [season, competitionA],
  )
  await client.query(
    'INSERT INTO app.competition_stages (id, season_id, code) VALUES ($1, $2, $3)',
    [stage, season, 'migration-stage'],
  )
  await expectFailure(
    'Finalized stage requires one final snapshot',
    [
      {
        text: 'UPDATE app.competition_stages SET sporting_state = $1 WHERE id = $2',
        values: ['finalized', stage],
      },
    ],
    '23514',
  )
  await expectFailure(
    'Stage transition has at most one typed ruling',
    [
      {
        text: `INSERT INTO app.stage_state_transitions
        (id, stage_id, from_state, to_state, reason, actor_id, result_ruling_id, tie_ruling_id)
        VALUES ($1, $2, 'active', 'awaiting_finalization', 'test', $3, $4, $5)`,
        values: [randomUUID(), stage, randomUUID(), randomUUID(), randomUUID()],
      },
    ],
    '23514',
  )

  await client.query('INSERT INTO app.teams (id, display_name) VALUES ($1, $2)', [
    team,
    'Migration Test Team',
  ])
  await client.query(
    'INSERT INTO app.season_applications (id, season_id, team_id) VALUES ($1, $2, $3)',
    [application, season, team],
  )
  await client.query(
    `INSERT INTO app.season_entries (id, season_id, team_id, approved_application_id)
      VALUES ($1, $2, $3, $4)`,
    [entry, season, team, application],
  )
  await client.query('INSERT INTO app.season_rosters (id, season_entry_id) VALUES ($1, $2)', [
    roster,
    entry,
  ])
  await client.query('INSERT INTO app.players (id) VALUES ($1)', [player])
  await client.query(
    'INSERT INTO app.roster_entries (id, roster_id, player_id) VALUES ($1, $2, $3)',
    [rosterEntry, roster, player],
  )
  await client.query(
    `INSERT INTO app.roster_registration_periods
      (id, player_id, season_id, roster_entry_id, effective_period)
      VALUES ($1, $2, $3, $4, daterange('2026-01-01', '2026-02-01', '[)'))`,
    [randomUUID(), player, season, rosterEntry],
  )
  await expectFailure(
    'Approved player registration cannot overlap in one season',
    [
      {
        text: `INSERT INTO app.roster_registration_periods
        (id, player_id, season_id, roster_entry_id, effective_period)
        VALUES ($1, $2, $3, $4, daterange('2026-01-15', '2026-02-15', '[)'))`,
        values: [randomUUID(), player, season, rosterEntry],
      },
    ],
    '23P01',
  )

  const format = randomUUID()
  const draft = randomUUID()
  const formatVersion = randomUUID()
  const stageVersion = randomUUID()
  const round = randomUUID()
  const homeSlot = randomUUID()
  const awaySlot = randomUUID()
  await client.query('INSERT INTO app.competition_formats (id, season_id) VALUES ($1, $2)', [
    format,
    season,
  ])
  await client.query(
    `INSERT INTO app.competition_format_drafts (id, format_id, editing_context)
      VALUES ($1, $2, 'migration-test')`,
    [draft, format],
  )
  await client.query(
    `INSERT INTO app.competition_format_versions
      (id, format_id, season_id, version_number, content_hash, source_draft_id, author_id)
      VALUES ($1, $2, $3, 1, 'migration-test', $4, $5)`,
    [formatVersion, format, season, draft, randomUUID()],
  )
  await client.query(
    `INSERT INTO app.competition_stage_versions
      (id, stage_id, format_version_id, name, position, format_type, configuration_hash)
      VALUES ($1, $2, $3, 'Test League', 1, 'league', 'migration-test')`,
    [stageVersion, stage, formatVersion],
  )
  await client.query(
    `INSERT INTO app.fixture_rounds (id, stage_id, stage_version_id, code, position)
      VALUES ($1, $2, $3, 'round-1', 1)`,
    [round, stage, stageVersion],
  )
  for (const [slotId, code, position] of [
    [homeSlot, 'home', 1],
    [awaySlot, 'away', 2],
  ] as const) {
    await client.query(
      `INSERT INTO app.stage_participant_slots
        (id, stage_id, stage_version_id, stable_code, position, expected_source_kind)
        VALUES ($1, $2, $3, $4, $5, 'direct_entry')`,
      [slotId, stage, stageVersion, code, position],
    )
  }
  await expectFailure(
    'Fixture Slot requires exactly one matching specialization',
    [
      {
        text: `INSERT INTO app.fixture_slots
          (id, stage_id, stage_version_id, slot_type, stable_code)
          VALUES ($1, $2, $3, 'league', 'missing-specialization')`,
        values: [randomUUID(), stage, stageVersion],
      },
      { text: 'SET CONSTRAINTS ALL IMMEDIATE' },
    ],
    '23514',
  )

  const fixtures = [
    { slot: randomUUID(), match: randomUUID(), revision: randomUUID(), position: 1 },
    { slot: randomUUID(), match: randomUUID(), revision: randomUUID(), position: 2 },
  ]
  for (const fixture of fixtures) {
    await client.query(
      `INSERT INTO app.fixture_slots (id, stage_id, stage_version_id, slot_type, stable_code)
        VALUES ($1, $2, $3, 'league', $4)`,
      [fixture.slot, stage, stageVersion, `fixture-${fixture.position}`],
    )
    await client.query(
      `INSERT INTO app.league_fixture_slots
        (id, fixture_slot_id, fixture_round_id, home_stage_participant_slot_id,
         away_stage_participant_slot_id, position)
        VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), fixture.slot, round, homeSlot, awaySlot, fixture.position],
    )
    await client.query(
      `INSERT INTO app.matches (id, fixture_slot_id, stage_id, calendar_uid)
        VALUES ($1, $2, $3, $4)`,
      [fixture.match, fixture.slot, stage, `migration-${fixture.position}-${fixture.match}`],
    )
    await client.query(
      `INSERT INTO app.match_schedule_revisions
        (id, match_id, timezone, venue_designation, internal_reason, actor_id, published_at)
        VALUES ($1, $2, 'Europe/Kyiv', 'home', 'migration-test', $3, now())`,
      [fixture.revision, fixture.match, randomUUID()],
    )
  }
  await client.query(
    `INSERT INTO app.match_participant_occupancies
      (id, match_id, season_entry_id, schedule_revision_id, planned_period)
      VALUES ($1, $2, $3, $4,
        tstzrange('2026-05-01T10:00:00Z', '2026-05-01T12:00:00Z', '[)'))`,
    [randomUUID(), fixtures[0].match, entry, fixtures[0].revision],
  )
  await expectFailure(
    'One Season Entry cannot occupy overlapping Matches',
    [
      {
        text: `INSERT INTO app.match_participant_occupancies
          (id, match_id, season_entry_id, schedule_revision_id, planned_period)
          VALUES ($1, $2, $3, $4,
            tstzrange('2026-05-01T11:00:00Z', '2026-05-01T13:00:00Z', '[)'))`,
        values: [randomUUID(), fixtures[1].match, entry, fixtures[1].revision],
      },
    ],
    '23P01',
  )
  await client.query('SET CONSTRAINTS ALL IMMEDIATE')
  await client.query('ROLLBACK')

  console.info('Initial migration inventory, privileges, and negative constraints passed')
} catch (error) {
  console.error(
    'Initial migration verification failed:',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
  try {
    await client.query('ROLLBACK')
  } catch {
    // The connection may not have reached a transaction.
  }
} finally {
  await client.end()
}
