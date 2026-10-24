import { expect, type Page } from '@playwright/test'

/** Same read-only Golden assertions for local navigation and an isolated cloud Preview. */
export async function assertPublicSeason(page: Page) {
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

  const standings = page.getByRole('region', { name: 'Попередня турнірна таблиця', exact: true })
  const rows = standings.locator('tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('ФК Луг (демо)')
  await expect(rows.nth(0).getByRole('cell').last()).toHaveText('3')
  await expect(rows.nth(1)).toContainText('ФК Явір (демо)')
  await expect(rows.nth(1).getByRole('cell').nth(1)).toHaveText('0')
  await expect(rows.nth(2)).toContainText('ФК Берест (демо)')
  await expect(rows.nth(2).getByRole('cell').last()).toHaveText('-1')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}
