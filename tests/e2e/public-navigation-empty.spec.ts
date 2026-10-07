import { expect, test } from '@playwright/test'

test.skip(
  !process.env.PUBLIC_NAVIGATION_EMPTY_FIXTURE,
  'Requires a dedicated empty browser database',
)

test('empty PostgreSQL navigation shows a useful public state', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Змагання, які об’єднують громади' }),
  ).toBeVisible()
  await expect(page.getByText('Поки немає опублікованих змагань')).toBeVisible()
})
