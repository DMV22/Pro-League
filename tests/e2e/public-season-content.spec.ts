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
  expect(html).toContain('ФК Берест (демо)')
  expect(html).toContain('Тур L1')
  expect(html).toContain('Тур L2')

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
  await expect(secondRound).not.toContainText('0:0')
  await expect(secondRound).not.toContainText('0:3')
})
