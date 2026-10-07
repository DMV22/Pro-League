import { expect, test } from '@playwright/test'

test.skip(
  !process.env.PUBLIC_NAVIGATION_UNCONFIGURED_FIXTURE,
  'Requires a server without DATABASE_URL',
)

test('unconfigured database shows a clear public state without sample data', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Змагання, які об’єднують громади' }),
  ).toBeVisible()
  await expect(page.getByText('Дані змагань зараз недоступні')).toBeVisible()
  await expect(page.getByRole('link', { name: /Вигаданий кубок громад/ })).toHaveCount(0)
})
