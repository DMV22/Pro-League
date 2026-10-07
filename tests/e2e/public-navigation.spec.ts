import { expect, test } from '@playwright/test'

test.skip(
  !process.env.PUBLIC_NAVIGATION_TEST_FIXTURE,
  'Requires a dedicated seeded browser database',
)

test('visitor navigates from published Competition to Season with server-rendered content', async ({
  page,
  request,
}) => {
  const initialHtml = await (await request.get('/')).text()
  expect(initialHtml).toContain('Вигаданий кубок громад')

  await page.goto('/')
  const competition = page.getByRole('link', { name: /Вигаданий кубок громад/ })
  await expect(competition).toBeVisible()
  await competition.click()

  await expect(page).toHaveURL('/competitions/golden-cup')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Вигаданий кубок громад' }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Вигаданий кубок громад | ProLeague')

  await page.getByRole('link', { name: /Golden Season 2026/ }).click()
  await expect(page).toHaveURL('/competitions/golden-cup/seasons/2026-golden')
  await expect(page.getByRole('heading', { level: 1, name: 'Golden Season 2026' })).toBeVisible()
  await expect(page).toHaveTitle('Golden Season 2026 — Вигаданий кубок громад | ProLeague')
})

test('missing public Competition and Season do not expose entity metadata', async ({ page }) => {
  await page.goto('/competitions/missing-cup')
  await expect(page.getByRole('heading', { level: 1, name: 'Такої сторінки немає' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)

  await page.goto('/competitions/golden-cup/seasons/missing-season')
  await expect(page.getByRole('heading', { level: 1, name: 'Такої сторінки немає' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
})

test('non-canonical slug spelling resolves to the current public address', async ({ page }) => {
  await page.goto('/competitions/GOLDEN-CUP/seasons/2026-GOLDEN')
  await expect(page).toHaveURL('/competitions/golden-cup/seasons/2026-golden')
  await expect(page.getByRole('heading', { level: 1, name: 'Golden Season 2026' })).toBeVisible()
})
