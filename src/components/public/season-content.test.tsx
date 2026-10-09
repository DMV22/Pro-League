/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { PublicMatch } from '@/application/queries/public-season-path'
import { FixtureRounds } from '@/components/public/season-content'

afterEach(cleanup)

function renderMatch(overrides: Partial<PublicMatch>) {
  const match: PublicMatch = {
    id: 'match-1',
    sportingState: 'unscheduled',
    home: { seasonEntryId: 'entry-1', teamId: 'team-1', teamName: 'Команда А' },
    away: { seasonEntryId: 'entry-2', teamId: 'team-2', teamName: 'Команда Б' },
    kickoffOn: null,
    kickoffAtLocal: null,
    timezone: 'Europe/Kyiv',
    result: null,
    ...overrides,
  }

  render(
    <FixtureRounds
      rounds={[{ id: 'round-1', stageId: 'stage-1', code: '1', position: 1, matches: [match] }]}
    />,
  )
  return within(screen.getByRole('region', { name: 'Тур 1' }))
}

describe('public Scheduled Kickoff presentation', () => {
  it('preserves a known local time when the date is still unknown', () => {
    const round = renderMatch({ kickoffAtLocal: '18:00:00' })

    expect(round.getByText('Дату повідомлять пізніше · 18:00')).toBeVisible()
  })

  it('marks the time as unknown when only the date has been published', () => {
    const round = renderMatch({ kickoffOn: '2026-10-10' })

    expect(round.getByText('10 жовтня 2026 р. · Час повідомлять пізніше')).toBeVisible()
  })

  it('labels the previous kickoff rather than presenting it as the postponed match start', () => {
    const round = renderMatch({
      sportingState: 'postponed',
      kickoffOn: '2026-10-10',
      kickoffAtLocal: '18:00:00',
    })

    expect(
      round.getByText(
        'Попередній початок: 10 жовтня 2026 р., 18:00 · Нову дату й час повідомлять пізніше',
      ),
    ).toBeVisible()
  })

  it.each([
    {
      name: 'fully published kickoff',
      match: { kickoffOn: '2026-10-10', kickoffAtLocal: '18:00:00' },
      expected: '10 жовтня 2026 р., 18:00',
    },
    {
      name: 'unknown date and time',
      match: {},
      expected: 'Дату й час повідомлять пізніше',
    },
    {
      name: 'postponement without previous kickoff data',
      match: { sportingState: 'postponed' },
      expected: 'Нову дату й час повідомлять пізніше',
    },
    {
      name: 'postponement with only the previous date',
      match: { sportingState: 'postponed', kickoffOn: '2026-10-10' },
      expected:
        'Попередній початок: 10 жовтня 2026 р. · Час повідомлять пізніше · Нову дату й час повідомлять пізніше',
    },
    {
      name: 'postponement with only the previous time',
      match: { sportingState: 'postponed', kickoffAtLocal: '18:00:00' },
      expected:
        'Попередній початок: Дату повідомлять пізніше · 18:00 · Нову дату й час повідомлять пізніше',
    },
    {
      name: 'local midnight without converting the calendar date',
      match: {
        kickoffOn: '2026-10-10',
        kickoffAtLocal: '00:00:00',
        timezone: 'Pacific/Honolulu',
      },
      expected: '10 жовтня 2026 р., 00:00',
    },
  ] satisfies Array<{ name: string; match: Partial<PublicMatch>; expected: string }>)(
    'displays $name',
    ({ match, expected }) => {
      const round = renderMatch(match)

      expect(round.getByText(expected)).toBeVisible()
    },
  )
})
