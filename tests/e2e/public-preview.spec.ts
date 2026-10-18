import { expect, test } from '@playwright/test'

test.describe('isolated Neon Render Preview pilot', () => {
  test.skip(
    process.env.PUBLIC_PREVIEW_SMOKE !== '1',
    'Run only against the explicitly selected PR Preview',
  )
  test('synthetic public information is server-rendered and noindex', async ({
    page,
    request,
    baseURL,
  }) => {
    expect(baseURL).toMatch(/^https:\/\/pro-league-development-pr-\d+\.onrender\.com$/)
    const routes = ['/', '/competitions/golden-cup', '/competitions/golden-cup/seasons/2026-golden']
    for (const route of routes) {
      const response = await request.get(route)
      expect(response.ok()).toBeTruthy()
      expect(response.headers()['x-robots-tag']).toMatch(/noindex/i)
      const html = await response.text()
      expect(html).toContain('Тестовий PR Preview')
      expect(html).toContain('Вигаданий кубок громад')
      expect(html).not.toContain('Публічні дані тимчасово недоступні')
      await page.goto(route)
      await expect(page.getByRole('complementary', { name: 'Тестове середовище' })).toBeVisible()
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    }
    await expect(
      page.getByRole('heading', { name: 'Golden Season 2026', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Учасники сезону', exact: true })).toBeVisible()
    await expect(page.getByRole('table').first()).toBeVisible()
  })
})
