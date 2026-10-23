import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { assertPublicSeason } from '../support/public-season-assertions'

test.skip(
  !process.env.PUBLIC_NAVIGATION_TEST_FIXTURE,
  'Requires a dedicated seeded browser database',
)

const seasonPath = '/competitions/golden-cup/seasons/2026-golden'

// Test the rendered-HTML seam without mutating the shared Golden fixture or mocking SQL.
test('unavailable standings explain the failure and never render partial rankings', async ({
  page,
}) => {
  for (const reason of [
    'incomplete_inputs',
    'unsupported_rules',
    'unsupported_participation',
    'invalid_adjustments',
  ] as const) {
    // Playwright transforms imported TSX into component-test objects, not React elements.
    // Render the actual Server Component in a separate Node/tsx process instead.
    const html = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
      import {createElement} from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {SeasonStandings} from './src/components/public/season-standings.tsx';
      process.stdout.write(renderToStaticMarkup(createElement(SeasonStandings, {
        stages: [{stageId: 'league', stageName: 'Ліга', kind: 'unavailable', reason: process.argv[1]}]
      })));
    `,
        reason,
      ],
      { encoding: 'utf8' },
    )
    await page.setContent(html)
    await expect(page.getByRole('heading', { name: 'Попередня турнірна таблиця' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ліга' })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.locator('section > p').last()).not.toBeEmpty()
  }
})

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
      standings:
        document.getElementById('season-standings-title')?.closest('section')?.textContent ?? null,
    }
  }, html)
  expect(serverContent.entries).toContain('ФК Берест (демо)')
  expect(serverContent.entries).toContain('ФК Луг (демо)')
  expect(serverContent.firstRound).toContain('0:3')
  expect(serverContent.firstRound).toContain('Технічний результат')
  expect(serverContent.firstRound).not.toContain('2:1')
  expect(serverContent.secondRound).toContain('Перенесено')
  expect(serverContent.secondRound).not.toMatch(/\d+:\d+/)
  expect(serverContent.standings).toContain('Попередня турнірна таблиця')
  expect(serverContent.standings).toContain('ФК Явір (демо)')
  expect(serverContent.standings).not.toContain('ФК Сокіл (демо)')

  await page.goto(seasonPath)
  await assertPublicSeason(page)
})
