import { expect, test } from '@playwright/test'
import pg from 'pg'
import { goldenId } from '../../scripts/db/golden-season-fixture'
import { assertM3AcceptanceTarget, m3PrivateMarkers } from '../../scripts/db/m3-acceptance-fixture'
import { assertPublicSeason } from '../support/public-season-assertions'

test.skip(process.env.PUBLIC_M3_ACCEPTANCE_FIXTURE !== '1', 'Dedicated M3 local/CI fixture only')

test.beforeAll(async () => {
  const url = process.env.M3_ACCEPTANCE_DATABASE_URL
  const database = assertM3AcceptanceTarget(url, process.env.M3_ACCEPTANCE_CONFIRM_DB)
  if (process.env.DATABASE_URL !== url || process.env.PLAYWRIGHT_BASE_URL)
    throw new Error('M3 privacy tests require their own freshly started local production server')
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 })
  await client.connect()
  try {
    // Prevent an absent fixture from passing all negative assertions vacuously.
    const controls = await client.query<{ count: number }>(
      `select count(*)::int as count from (
       select display_name as marker from app.competitions where visibility='private'
       union all select name from app.seasons
       union all select display_name from app.teams where visibility='private'
       union all select s.venue_name_snapshot from app.match_schedule_revisions s
       where not exists(select 1 from app.matches m where m.current_schedule_revision_id=s.id)
       ) controls where marker=any($1::text[])`,
      [Object.values(m3PrivateMarkers)],
    )
    expect(controls.rows[0]?.count, 'all five private/noncurrent controls must exist').toBe(5)
    const identity = await client.query<{ database: string }>(
      'select current_database() as database',
    )
    expect(identity.rows[0]?.database).toBe(database)
    const privateGolden = await client.query<{ count: number }>(
      `select count(*)::int as count from (
       select id from app.news_articles where id=$1 and lifecycle_state='draft'
       union all select id from app.matches where id=$2 and visibility='private'
       union all select id from app.player_private_detail_versions where id=$3
       union all select id from app.match_result_versions where id=$4
       ) controls`,
      [
        goldenId('article-draft'),
        goldenId('redraw-blocked-match'),
        goldenId('player-birth-3'),
        goldenId('league-result-played'),
      ],
    )
    expect(
      privateGolden.rows[0]?.count,
      'Draft, Private, personal and old Result controls exist',
    ).toBe(4)
  } finally {
    await client.end()
  }
})

const forbidden = [
  ...Object.values(m3PrivateMarkers),
  'Чернетка: вигаданий календар',
  'Запланована демо-публікація',
  'Демо Неповнолітній',
  '2011-09-01',
  '1991-12-31',
  goldenId('article-draft'),
  goldenId('redraw-blocked-match'),
  goldenId('player-birth-3'),
  goldenId('league-result-played'),
  'golden-redraw-blocked@example.invalid',
  'Вигаданий протест: технічна поразка господарів',
]

for (const route of [
  '/',
  '/competitions/golden-cup',
  '/competitions/golden-cup/seasons/2026-golden',
  '/competitions/m3-private-cup',
  '/competitions/golden-cup/seasons/m3-private-season',
  '/competitions/m3-private-cup/seasons/m3-public-child',
]) {
  test(`Published-only response and metadata: ${route}`, async ({ page, request }) => {
    const response = await request.get(route)
    const html = await response.text()
    // Inspect the COMPLETE response, including scripts/RSC data, before parsing visible DOM.
    for (const marker of forbidden) expect(html).not.toContain(marker)
    await page.goto(route)
    const metadata = await page.locator('head').innerHTML()
    for (const marker of forbidden) expect(metadata).not.toContain(marker)
    if (route.includes('m3-')) {
      // Streamed notFound can return 200: verify the observable boundary, not status alone.
      await expect(page.getByRole('heading', { name: 'Такої сторінки немає' })).toBeVisible()
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        'content',
        /noindex/,
      )
    } else {
      expect(response.ok()).toBe(true)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      if (route.includes('/seasons/')) await assertPublicSeason(page)
    }
  })
}
