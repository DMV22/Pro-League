import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.skip(
  !process.env.PUBLIC_NAVIGATION_TEST_FIXTURE,
  'Requires a dedicated seeded browser database',
)

for (const route of [
  { path: '/competitions/golden-cup', heading: 'Вигаданий кубок громад' },
  {
    path: '/competitions/golden-cup/seasons/2026-golden',
    heading: 'Golden Season 2026',
  },
] as const) {
  test(`${route.path} has no detectable WCAG A or AA violations`, async ({ page }) => {
    await page.goto(route.path)
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
}
