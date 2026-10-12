import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { startPublicCacheServer } from '../support/public-cache-server'

test.skip(
  !process.env.PUBLIC_CACHE_BROWSER_FIXTURE,
  'Requires a dedicated local/CI public-cache database and production build',
)
test.describe.configure({ mode: 'serial' })
let server: Awaited<ReturnType<typeof startPublicCacheServer>>
test.beforeAll(async () => {
  server = await startPublicCacheServer(process.env.DATABASE_URL!)
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(server.baseURL)).ok
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true)
})
test.afterAll(async () => {
  if (server) await server.close()
})
test.afterEach(async ({}, info) => {
  if (server && info.status !== info.expectedStatus) console.error(server.logs())
})

test('refreshes committed sources, warns on warm outage, fails cold, and never revives hidden data', async ({
  page,
}) => {
  test.setTimeout(90_000)
  for (const path of ['/', server.competitionPath, server.seasonPath]) {
    await page.goto(server.baseURL + path)
    await expect(page.getByText('Кеш-тест (синтетичний)', { exact: false }).first()).toBeVisible()
    await expect(page.locator('time').first()).toBeVisible()
  }
  await server.rename()
  await page.goto(server.baseURL + server.seasonPath)
  await expect(
    page.getByText('Оновлений кеш-тест (синтетичний)', { exact: true }).first(),
  ).toBeVisible()
  const sourceTime = await page.locator('time').first().getAttribute('datetime')
  server.offline()
  await page.reload()
  await expect(
    page.getByRole('status').filter({ hasText: 'Не вдалося підтвердити актуальність' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Кеш-сезон (синтетичний)' })).toBeVisible()
  await expect(page.locator('time').first()).toHaveAttribute('datetime', sourceTime!)
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await server.restart()
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(server.baseURL)).ok
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true)
  await page.goto(server.baseURL + server.seasonPath)
  await expect(
    page.getByRole('heading', { name: 'Публічні дані тимчасово недоступні' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Кеш-сезон (синтетичний)' })).toHaveCount(0)
  server.online()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Кеш-сезон (синтетичний)' })).toBeVisible()
  await server.hide()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Такої сторінки немає' })).toBeVisible()
  server.offline()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Публічні дані тимчасово недоступні' }),
  ).toBeVisible()
  await expect(page.getByText('Кеш-сезон (синтетичний)')).toHaveCount(0)
  await expect(page.getByText(/postgresql:\/\/|ECONNREFUSED/)).toHaveCount(0)
})
