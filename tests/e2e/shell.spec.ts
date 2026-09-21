import { expect, test } from '@playwright/test'

test('renders the public Portal shell and supports its primary navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('ProLeague — місцевий футбол')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Нова платформа місцевого футболу' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Основна навігація' })).toBeVisible()
  await expect(page.getByText('Next.js foundation · online')).toBeVisible()
})

test('renders the Admin shell as a non-indexable area', async ({ page }) => {
  await page.goto('/admin')

  await expect(page).toHaveTitle('Адміністрування | ProLeague')
  await expect(page.getByRole('heading', { level: 1, name: 'Керування порталом' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Навігація адміністратора' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex.*nofollow|nofollow.*noindex/,
  )
})

test('uses the skip link to move keyboard focus to the main content', async ({ page }) => {
  await page.goto('/')

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Перейти до основного вмісту' })
  await expect(skipLink).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})

test('renders a useful not-found state and returns to the Portal', async ({ page }) => {
  await page.goto('/missing-page')

  await expect(page.getByRole('heading', { name: 'Такої сторінки немає' })).toBeVisible()
  await page.getByRole('link', { name: 'Повернутися на головну' }).click()
  await expect(page).toHaveURL('/')
})

test('does not overflow the active viewport', async ({ page }) => {
  await page.goto('/')

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )

  expect(hasHorizontalOverflow).toBe(false)
})
