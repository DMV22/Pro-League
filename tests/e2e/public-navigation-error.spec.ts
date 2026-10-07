import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.skip(!process.env.PUBLIC_NAVIGATION_ERROR_FIXTURE, 'Requires an unreachable test database URL')

test('database failure shows an accessible retry state without exposing connection details', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Не вдалося завантажити сторінку' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Спробувати ще раз' })).toBeVisible()
  await expect(page.getByText(/ECONNREFUSED|postgresql:\/\//)).toHaveCount(0)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
