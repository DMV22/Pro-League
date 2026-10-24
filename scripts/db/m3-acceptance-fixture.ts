import type pg from 'pg'
import { goldenId, seedGoldenSeason } from './golden-season-fixture'
import { assertMigrationLedger, readMigrationManifest, type LedgerRow } from './migration-ledger'

export const m3PrivateMarkers = {
  competition: 'M3_PRIVATE_COMPETITION_97',
  season: 'M3_PRIVATE_SEASON_97',
  child: 'M3_PRIVATE_PARENT_CHILD_97',
  team: 'M3_PRIVATE_TEAM_97',
  schedule: 'M3_NONCURRENT_SCHEDULE_97',
} as const

export function assertM3AcceptanceTarget(
  value: string | undefined,
  confirmation: string | undefined,
) {
  let url: URL
  try {
    url = new URL(value ?? '')
  } catch {
    throw new Error('M3 acceptance requires an explicit dedicated loopback database URL')
  }
  const database = decodeURIComponent(url.pathname.slice(1))
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !url.username ||
    !['proleague_m3_acceptance_local', 'proleague_m3_acceptance_ci'].includes(database) ||
    confirmation !== database ||
    url.search ||
    url.hash
  )
    throw new Error('M3 acceptance refuses shared, Golden, remote or unconfirmed databases')
  return database
}

/** Only called after the CLI target guard; never resets or changes shared Golden data. */
export async function prepareM3Acceptance(client: pg.PoolClient, database: string) {
  await client.query('BEGIN')
  try {
    await client.query("SET LOCAL statement_timeout = '120s'")
    await client.query("SET LOCAL lock_timeout = '5s'")
    const identity = await client.query<{ database: string }>(
      'select current_database() as database',
    )
    if (identity.rows[0]?.database !== database) throw new Error('M3 database identity differs')
    // Avoid races between independent fixture preparers, and fail on any pre-existing app data.
    await client.query('select pg_advisory_xact_lock(749203, 97)')
    const ledger = await client.query<LedgerRow>(
      'select hash, created_at::text from app.__drizzle_migrations order by created_at, id',
    )
    assertMigrationLedger(readMigrationManifest(), ledger.rows)
    const tables = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname='app' and tablename not in ('__drizzle_migrations','public_projection_revisions')",
    )
    for (const { tablename } of tables.rows) {
      if (!/^[a-z_][a-z_0-9]*$/.test(tablename)) throw new Error('Unexpected fixture table')
      const populated = await client.query(`select 1 from app."${tablename}" limit 1`)
      if (populated.rowCount) throw new Error('M3 fixture must be empty; reset is not supported')
    }
    await seedGoldenSeason(client)
    const id = (key: string) => goldenId(`m3-acceptance-${key}`)
    await client.query(
      "insert into app.competitions(id,display_name,visibility) values($1,$2,'private')",
      [id('competition'), m3PrivateMarkers.competition],
    )
    await client.query(
      `insert into app.competition_slugs(id,competition_id,display_slug,normalized_slug,valid_from_at)
       values($1,$2,'m3-private-cup','m3-private-cup',now())`,
      [id('competition-slug'), id('competition')],
    )
    await client.query('update app.competitions set current_slug_id=$1 where id=$2', [
      id('competition-slug'),
      id('competition'),
    ])
    for (const [key, parent, name, visibility, slug] of [
      ['season', goldenId('competition'), m3PrivateMarkers.season, 'private', 'm3-private-season'],
      ['child', id('competition'), m3PrivateMarkers.child, 'public', 'm3-public-child'],
    ]) {
      await client.query(
        "insert into app.seasons(id,competition_id,name,timezone,visibility) values($1,$2,$3,'Europe/Kyiv',$4)",
        [id(key), parent, name, visibility],
      )
      await client.query(
        'insert into app.season_slugs(id,competition_id,season_id,display_slug,normalized_slug,valid_from_at) values($1,$2,$3,$4,$4,now())',
        [id(`${key}-slug`), parent, id(key), slug],
      )
      await client.query('update app.seasons set current_slug_id=$1 where id=$2', [
        id(`${key}-slug`),
        id(key),
      ])
    }
    await client.query(
      "insert into app.teams(id,display_name,visibility) values($1,$2,'private')",
      [id('team'), m3PrivateMarkers.team],
    )
    await client.query(
      `insert into app.season_applications(id,season_id,team_id,state,submitted_on)
       values($1,$2,$3,'approved','2026-02-15')`,
      [id('application'), goldenId('season'), id('team')],
    )
    await client.query(
      'insert into app.season_entries(id,season_id,team_id,approved_application_id) values($1,$2,$3,$4)',
      [id('entry'), goldenId('season'), id('team'), id('application')],
    )
    // A revision alone must not replace the owner's current schedule pointer.
    await client.query(
      `insert into app.match_schedule_revisions
       (id,match_id,timezone,venue_designation,home_assignment_id,away_assignment_id,internal_reason,venue_name_snapshot,actor_id,published_at)
       select $1,id,'Europe/Kyiv','home',current_home_assignment_id,current_away_assignment_id,$2,$2,$3,now()
       from app.matches where id=$4`,
      [
        id('schedule'),
        m3PrivateMarkers.schedule,
        goldenId('fictional-admin'),
        goldenId('league-match-0'),
      ],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}
