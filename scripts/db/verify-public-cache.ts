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
