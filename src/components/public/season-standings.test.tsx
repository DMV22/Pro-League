/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { SeasonStandings } from './season-standings'

afterEach(cleanup)

it('explains an unsupported Stage without rendering a misleading table', () => {
  render(
    <SeasonStandings
      stages={[
        { stageId: 'league', stageName: 'Ліга', kind: 'unavailable', reason: 'unsupported_rules' },
      ]}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Попередня турнірна таблиця' })).toBeVisible()
  expect(screen.getByText('Правила ранжування цього етапу поки не підтримуються.')).toBeVisible()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
