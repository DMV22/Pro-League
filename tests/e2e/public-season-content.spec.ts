import { expect, test } from '@playwright/test'

test.skip(
  !process.env.PUBLIC_NAVIGATION_TEST_FIXTURE,
  'Requires a dedicated seeded browser database',
)

const seasonPath = '/competitions/golden-cup/seasons/2026-golden'

test('visitor reads published Season Entries and both representative Fixture Rounds in server HTML', async ({
  page,
  request,
}) => {
  const response = await request.get(seasonPath)
  expect(response.ok()).toBe(true)
  const html = await response.text()
  // Parse the response without executing scripts or hydration. Streamed HTML can be
  // in hidden containers; assert its semantic content, not pre-hydration visibility.
  const serverContent = await page.evaluate((responseHtml) => {
    const document = new DOMParser().parseFromString(responseHtml, 'text/html')
    document.querySelectorAll('script, template').forEach((node) => node.remove())
    const entriesTitle = document.getElementById('season-entries-title')
    return {
      entries: entriesTitle?.closest('section')?.textContent ?? null,
      firstRound: document.querySelector('section[aria-label="Тур L1"]')?.textContent ?? null,
      secondRound: document.querySelector('section[aria-label="Тур L2"]')?.textContent ?? null,
    }
  }, html)
  expect(serverContent.entries).toContain('ФК Берест (демо)')
  expect(serverContent.entries).toContain('ФК Луг (демо)')
  expect(serverContent.firstRound).toContain('0:3')
  expect(serverContent.firstRound).toContain('Технічний результат')
  expect(serverContent.firstRound).not.toContain('2:1')
  expect(serverContent.secondRound).toContain('Перенесено')
  expect(serverContent.secondRound).not.toMatch(/\d+:\d+/)

  await page.goto(seasonPath)
  const entries = page.getByRole('region', { name: 'Учасники сезону' })
  await expect(entries.getByText('ФК Берест (демо)')).toBeVisible()
  await expect(entries.getByText('ФК Луг (демо)')).toBeVisible()

  const firstRound = page.getByRole('region', { name: 'Тур L1' })
  await expect(firstRound).toContainText('0:3')
  await expect(firstRound).toContainText('Технічний результат')
  await expect(firstRound).not.toContainText('2:1')

  const secondRound = page.getByRole('region', { name: 'Тур L2' })
  await expect(secondRound).toContainText('Перенесено')
  await expect(secondRound).not.toContainText(/\d+:\d+/)
})
