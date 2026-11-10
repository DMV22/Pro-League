import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('direct Admin JSON entry point is closed and uncacheable without credentials', async ({
  request,
}) => {
  const response = await request.get('/api/admin/access')
  expect(response.status()).toBe(503)
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(await response.json()).toEqual({
    status: 'unavailable',
    code: 'authorization_unavailable',
  })
})

for (const route of ['/admin', '/admin/sign-in']) {
  test(`${route} stays closed without loading the Clerk SDK`, async ({ page }) => {
    const clerkRequests: string[] = []
    const scripts: Promise<{ url: string; source: string }>[] = []
    page.on('request', (request) => {
      if (/clerk\.(accounts|com)|clerk\.browser/.test(request.url()))
        clerkRequests.push(request.url())
    })
    page.on('response', (response) => {
      if (response.ok() && response.request().resourceType() === 'script') {
        scripts.push(response.text().then((source) => ({ url: response.url(), source })))
      }
    })
    await page.goto(route)
    await expect(page.getByRole('heading', { name: 'Доступ до адміністрування' })).toBeVisible()
    await expect(
      page.getByText('Перевірка доступу зараз недоступна.', { exact: false }),
    ).toBeVisible()
    expect(clerkRequests).toEqual([])
    // A local Next.js chunk can include Clerk even with no requests to its CDN.
    const sdkScripts = (await Promise.all(scripts))
      .filter(({ source }) => /@clerk\/|\bClerkProvider\b|clerk\.browser/i.test(source))
      .map(({ url }) => url)
    expect(sdkScripts).toEqual([])
  })
}

test('a direct Server Action POST cannot use the public layout as authority', async ({
  request,
  baseURL,
}) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Local production build action identifier is not valid for an unrelated external build',
  )
  const manifest = JSON.parse(
    readFileSync('.next/server/server-reference-manifest.json', 'utf8'),
  ) as { node: Record<string, { exportedName?: string }> }
  const entry = Object.entries(manifest.node).find(
    ([, value]) => value.exportedName === 'checkAdminAccessAction',
  )
  expect(entry, 'Access status action must remain covered by a real HTTP test').toBeDefined()
  const response = await request.post('/admin', {
    headers: {
      'Next-Action': entry![0],
      'Content-Type': 'text/plain;charset=UTF-8',
      Origin: new URL(baseURL!).origin,
    },
    data: '[]',
  })
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('authorization_unavailable')
})
