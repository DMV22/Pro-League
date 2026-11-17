import assert from 'node:assert/strict'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { readDatabaseUrl, assertLocalDatabaseUrl } from '../../src/server/db/config'
import { createPublicProjectionStateQuery } from '../../src/server/queries/public-projection-state'
import { loadProjectEnv } from './load-env'

loadProjectEnv()
const url = readDatabaseUrl('DATABASE_URL')
assertLocalDatabaseUrl(url, 'DATABASE_URL')
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 })
await client.connect()
try {
  const query = createPublicProjectionStateQuery(drizzle({ client }))
  const before = await query.read({ kind: 'home' })
  assert.equal(before.kind, 'found')
  await client.query('BEGIN')
  await client.query(
    "insert into app.competitions(id,display_name,visibility) values('01990000-0000-7000-8000-000000009401','Synthetic cache fixture','public')",
  )
  const changed = await query.read({ kind: 'home' })
  assert.ok(before.kind === 'found' && changed.kind === 'found')
  assert.ok(BigInt(changed.state.revision) > BigInt(before.state.revision))
  assert.ok(changed.state.lastUpdatedAt)
  await client.query(
    "insert into app.competition_slugs(id,competition_id,display_slug,normalized_slug,valid_from_at) values('01990000-0000-7000-8000-000000009402','01990000-0000-7000-8000-000000009401','cache-fixture','cache-fixture',now())",
  )
  await client.query(
    "update app.competitions set current_slug_id='01990000-0000-7000-8000-000000009402' where id='01990000-0000-7000-8000-000000009401'",
  )
  await client.query(
    "insert into app.seasons(id,competition_id,name,timezone,visibility) values('01990000-0000-7000-8000-000000009403','01990000-0000-7000-8000-000000009401','Cache season','Europe/Kyiv','public')",
  )
  await client.query(
    "insert into app.season_slugs(id,competition_id,season_id,display_slug,normalized_slug,valid_from_at) values('01990000-0000-7000-8000-000000009404','01990000-0000-7000-8000-000000009401','01990000-0000-7000-8000-000000009403','cache-season','cache-season',now())",
  )
  await client.query(
    "update app.seasons set current_slug_id='01990000-0000-7000-8000-000000009404' where id='01990000-0000-7000-8000-000000009403'",
  )
  const route = {
    kind: 'season' as const,
    competitionSlug: 'cache-fixture',
    seasonSlug: 'cache-season',
  }
  const season = await query.read(route, new Date('2026-04-05T21:30:00Z'))
  assert.ok(season.kind === 'found')
  assert.equal(season.state.seasonDate, '2026-04-06')
  // A Season snapshot also carries its Competition tag. Its revision is a separate clock.
  await client.query(
    "update app.competitions set display_name=display_name || ' changed' where id='01990000-0000-7000-8000-000000009401'",
  )
  const competitionClock = await client.query<{ revision: string }>(
    "select revision::text from app.public_projection_revisions where projection_key='competition:01990000-0000-7000-8000-000000009401'",
  )
  const seasonBefore = await query.read(route, new Date('2026-04-05T21:30:00Z'))
  assert(seasonBefore.kind === 'found')
  await client.query(
    `insert into app.cache_invalidation_intents(id,semantic_target,committed_version,created_at)
    values('01990000-0000-7000-8000-000000009405','competition:01990000-0000-7000-8000-000000009401',$1,clock_timestamp()-interval '61 seconds')`,
    [competitionClock.rows[0].revision],
  )
  const seasonPending = await query.read(route, new Date('2026-04-05T21:30:00Z'))
  assert(seasonPending.kind === 'found' && seasonPending.synchronization === 'attention')
  assert.equal(seasonPending.state.cacheGeneration, seasonBefore.state.cacheGeneration)
  await client.query(
    "update app.cache_invalidation_intents set state='confirmed',confirmed_at=clock_timestamp() where id='01990000-0000-7000-8000-000000009405'",
  )
  const seasonConfirmed = await query.read(route, new Date('2026-04-05T21:30:00Z'))
  assert(seasonConfirmed.kind === 'found' && seasonConfirmed.synchronization === undefined)
  assert.notEqual(seasonConfirmed.state.cacheGeneration, seasonBefore.state.cacheGeneration)
  assert.equal(seasonConfirmed.state.revision, seasonBefore.state.revision)
  assert.deepEqual(
    JSON.parse(seasonConfirmed.state.cacheGeneration).map((item: string[]) => item[0]),
    [
      'competition:01990000-0000-7000-8000-000000009401',
      'schedule:01990000-0000-7000-8000-000000009403',
      'season:01990000-0000-7000-8000-000000009403',
      'standings:01990000-0000-7000-8000-000000009403',
    ],
  )
  await client.query(`insert into app.cache_invalidation_intents(id,semantic_target,committed_version,state,confirmed_at)
    values('01990000-0000-7000-8000-000000009406','portal',1,'confirmed',clock_timestamp())`)
  const unrelated = await query.read(route, new Date('2026-04-05T21:30:00Z'))
  assert(unrelated.kind === 'found')
  assert.equal(unrelated.state.cacheGeneration, seasonConfirmed.state.cacheGeneration)
  assert.deepEqual(await query.read({ kind: 'competition', competitionSlug: 'CACHE-FIXTURE' }), {
    kind: 'redirect',
    pathname: '/competitions/cache-fixture',
  })
  await client.query(
    "update app.seasons set name='Changed cache season' where id='01990000-0000-7000-8000-000000009403'",
  )
  const renamed = await query.read(route, new Date('2026-04-05T21:30:00Z'))
  assert.ok(renamed.kind === 'found')
  assert.ok(
    BigInt(renamed.state.revision) > BigInt(season.state.revision),
    'Raw source SQL must advance the clock even without an updated_at assignment',
  )
  await client.query(
    "update app.seasons set visibility='private' where id='01990000-0000-7000-8000-000000009403'",
  )
  assert.deepEqual(await query.read(route), { kind: 'notFound' })
  const privileges = await client.query(
    "select has_table_privilege('app_runtime','app.public_projection_revisions','UPDATE') as can_forge",
  )
  assert.equal(privileges.rows[0].can_forge, false)
  await client.query('ROLLBACK')
  assert.deepEqual(
    await query.read({ kind: 'home' }),
    before,
    'Rollback must undo projection clock changes',
  )
  console.log('Public projection source clocks and rollback verified')
} finally {
  await client.query('ROLLBACK')
  await client.end()
}
