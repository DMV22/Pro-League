import assert from 'node:assert/strict'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import {
  competitions,
  competitionSlugs,
  seasons,
  seasonSlugs,
} from '../../src/modules/competition/infrastructure/schema'
import { assertLocalDatabaseUrl, readDatabaseUrl } from '../../src/server/db/config'
import { createPublicNavigationQueries } from '../../src/server/queries/public-navigation'
import { loadProjectEnv } from './load-env'

loadProjectEnv()
const url = readDatabaseUrl('DATABASE_URL')
assertLocalDatabaseUrl(url, 'DATABASE_URL')

const uid = (number: number) => `01990091-0000-7000-8000-${number.toString(16).padStart(12, '0')}`
const ids = {
  cup: uid(1),
  emptyCup: uid(2),
  hiddenCup: uid(3),
  unsluggedCup: uid(4),
  cupSlug: uid(5),
  oldCupSlug: uid(6),
  emptyCupSlug: uid(7),
  hiddenCupSlug: uid(8),
  publicSeason: uid(9),
  hiddenSeason: uid(10),
  hiddenParentSeason: uid(11),
  seasonSlug: uid(12),
  oldSeasonSlug: uid(13),
  hiddenSeasonSlug: uid(14),
  hiddenParentSeasonSlug: uid(15),
}

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 })
const client = await pool.connect()

try {
  const schema = await client.query<{ table_name: string | null }>(
    "select to_regclass('app.competitions')::text as table_name",
  )
  if (!schema.rows[0]?.table_name) {
    throw new Error('Apply the reviewed migrations before public navigation verification')
  }
  await client.query('BEGIN')
  const database = drizzle({ client })
  const queries = createPublicNavigationQueries(database)
  const validFromAt = new Date('2026-01-01T00:00:00.000Z')

  await database.insert(competitions).values([
    { id: ids.cup, displayName: 'Public Cup', visibility: 'public' },
    { id: ids.emptyCup, displayName: 'Empty Cup', visibility: 'public' },
    { id: ids.hiddenCup, displayName: 'Secret Cup', visibility: 'private' },
    { id: ids.unsluggedCup, displayName: 'Unslugged Cup', visibility: 'public' },
  ])
  await database.insert(seasons).values([
    {
      id: ids.publicSeason,
      competitionId: ids.cup,
      name: 'Season 2026',
      timezone: 'Europe/Kyiv',
      visibility: 'public',
    },
    {
      id: ids.hiddenSeason,
      competitionId: ids.cup,
      name: 'Secret Season',
      timezone: 'Europe/Kyiv',
      visibility: 'private',
    },
    {
      id: ids.hiddenParentSeason,
      competitionId: ids.hiddenCup,
      name: 'Public child of private parent',
      timezone: 'Europe/Kyiv',
      visibility: 'public',
    },
  ])
  await database.insert(competitionSlugs).values([
    {
      id: ids.cupSlug,
      competitionId: ids.cup,
      displaySlug: 'public-cup',
      normalizedSlug: 'public-cup',
      validFromAt,
    },
    {
      id: ids.oldCupSlug,
      competitionId: ids.cup,
      displaySlug: 'former-cup',
      normalizedSlug: 'former-cup',
      validFromAt,
    },
    {
      id: ids.emptyCupSlug,
      competitionId: ids.emptyCup,
      displaySlug: 'empty-cup',
      normalizedSlug: 'empty-cup',
      validFromAt,
    },
    {
      id: ids.hiddenCupSlug,
      competitionId: ids.hiddenCup,
      displaySlug: 'secret-cup',
      normalizedSlug: 'secret-cup',
      validFromAt,
    },
  ])
  await database.insert(seasonSlugs).values([
    {
      id: ids.seasonSlug,
      competitionId: ids.cup,
      seasonId: ids.publicSeason,
      displaySlug: '2026',
      normalizedSlug: '2026',
      validFromAt,
    },
    {
      id: ids.oldSeasonSlug,
      competitionId: ids.cup,
      seasonId: ids.publicSeason,
      displaySlug: 'former-2026',
      normalizedSlug: 'former-2026',
      validFromAt,
    },
    {
      id: ids.hiddenSeasonSlug,
      competitionId: ids.cup,
      seasonId: ids.hiddenSeason,
      displaySlug: 'secret-season',
      normalizedSlug: 'secret-season',
      validFromAt,
    },
    {
      id: ids.hiddenParentSeasonSlug,
      competitionId: ids.hiddenCup,
      seasonId: ids.hiddenParentSeason,
      displaySlug: 'public-child',
      normalizedSlug: 'public-child',
      validFromAt,
    },
  ])
  for (const [competitionId, currentSlugId] of [
    [ids.cup, ids.cupSlug],
    [ids.emptyCup, ids.emptyCupSlug],
    [ids.hiddenCup, ids.hiddenCupSlug],
  ]) {
    await database
      .update(competitions)
      .set({ currentSlugId })
      .where(eq(competitions.id, competitionId))
  }
  for (const [seasonId, currentSlugId] of [
    [ids.publicSeason, ids.seasonSlug],
    [ids.hiddenSeason, ids.hiddenSeasonSlug],
    [ids.hiddenParentSeason, ids.hiddenParentSeasonSlug],
  ]) {
    await database.update(seasons).set({ currentSlugId }).where(eq(seasons.id, seasonId))
  }

  const competitionList = await queries.listCompetitions()
  assert.deepEqual(
    competitionList.map(({ name, slug }) => ({ name, slug })),
    [
      { name: 'Empty Cup', slug: 'empty-cup' },
      { name: 'Public Cup', slug: 'public-cup' },
    ],
  )
  const cup = await queries.resolveCompetition('public-cup')
  assert.equal(cup.kind, 'found')
  if (cup.kind === 'found') {
    assert.deepEqual(
      cup.value.seasons.map(({ name }) => name),
      ['Season 2026'],
    )
    assert.deepEqual(JSON.parse(JSON.stringify(cup.value)), cup.value)
  }
  assert.deepEqual(await queries.resolveCompetition('former-cup'), {
    kind: 'redirect',
    pathname: '/competitions/public-cup',
  })
  assert.equal((await queries.resolveCompetition('empty-cup')).kind, 'found')
  assert.equal((await queries.resolveCompetition('secret-cup')).kind, 'notFound')
  assert.equal((await queries.resolveCompetition('missing-cup')).kind, 'notFound')

  const season = await queries.resolveSeason('public-cup', '2026')
  assert.equal(season.kind, 'found')
  if (season.kind === 'found') {
    assert.equal(season.value.season.name, 'Season 2026')
    assert.deepEqual(JSON.parse(JSON.stringify(season.value)), season.value)
  }
  assert.deepEqual(await queries.resolveSeason('former-cup', 'former-2026'), {
    kind: 'redirect',
    pathname: '/competitions/public-cup/seasons/2026',
  })
  assert.equal((await queries.resolveSeason('public-cup', 'secret-season')).kind, 'notFound')
  assert.equal((await queries.resolveSeason('secret-cup', 'public-child')).kind, 'notFound')
  assert.equal((await queries.resolveSeason('empty-cup', '2026')).kind, 'notFound')
  assert.equal((await queries.resolveSeason('public-cup', 'missing-season')).kind, 'notFound')

  console.log('Public navigation slug, visibility, empty, and serialization checks passed')
} finally {
  await client.query('ROLLBACK')
  client.release()
  await pool.end()
}
