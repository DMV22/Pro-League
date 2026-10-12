import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.skip(!process.env.PUBLIC_NAVIGATION_ERROR_FIXTURE, 'Requires an unreachable test database URL')

test('database failure shows an accessible retry state without exposing connection details', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Публічні дані тимчасово недоступні' }),
  ).toBeVisible()
  await expect(
    page.getByText('Не вдалося отримати підтверджену інформацію. Спробуйте повернутися пізніше.'),
  ).toBeVisible()
  await expect(page.getByText(/ECONNREFUSED|postgresql:\/\//)).toHaveCount(0)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
