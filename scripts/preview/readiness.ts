import assert from 'node:assert/strict'

/** Trusted smoke, executed in a subprocess without control-plane credentials. */
export async function verifyPublicPreview(origin: string, pr: number) {
  if (
    !Number.isSafeInteger(pr) ||
    pr < 1 ||
    origin !== `https://pro-league-development-pr-${pr}.onrender.com`
  )
    throw new Error('Preview origin differs')
  const { chromium, devices, expect, request } = await import('@playwright/test')
  const http = await request.newContext({ baseURL: origin, timeout: 90_000 })
  const browser = await chromium.launch({ headless: true })
  const routes = ['/', '/competitions/golden-cup', '/competitions/golden-cup/seasons/2026-golden']
  try {
    // Warm up once; a failed warm request is not acceptance evidence.
    await http.get('/').catch(() => undefined)
    for (const route of routes) {
      const response = await http.get(route)
      assert(response.ok() && response.url() === `${origin}${route}`)
      assert(/noindex/i.test(response.headers()['x-robots-tag'] ?? ''))
      const html = await response.text()
      assert(html.includes('Тестовий PR Preview') && html.includes('Вигаданий кубок громад'))
      assert(
        !html.includes('Публічні дані тимчасово недоступні') &&
          !html.includes('Не вдалося завантажити сторінку'),
      )
    }
    for (const device of ['Desktop Chrome', 'Pixel 7']) {
      const context = await browser.newContext({ ...devices[device] })
      try {
        const page = await context.newPage()
        for (const route of routes) {
          await page.goto(`${origin}${route}`, { timeout: 90_000 })
          await expect(
            page.getByRole('complementary', { name: 'Тестове середовище' }),
          ).toBeVisible()
          await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
        }
        await expect(
          page.getByRole('heading', { name: 'Golden Season 2026', exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'Учасники сезону', exact: true }),
        ).toBeVisible()
        await expect(page.getByRole('table').first()).toBeVisible()
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
    await http.dispose()
  }
}
