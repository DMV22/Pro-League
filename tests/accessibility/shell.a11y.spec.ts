import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = [
  { path: '/', heading: 'Нова платформа місцевого футболу' },
  { path: '/admin', heading: 'Керування порталом' },
  { path: '/missing-page', heading: 'Такої сторінки немає' },
] as const

for (const route of routes) {
  test(`${route.path} has no detectable WCAG A or AA violations`, async ({ page }) => {
    await page.goto(route.path)
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
}
