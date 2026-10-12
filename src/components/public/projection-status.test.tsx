/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ProjectionStatus } from './projection-status'
afterEach(cleanup)

it('announces stale data and renders the committed source timestamp', () => {
  render(<ProjectionStatus freshness="stale" lastUpdatedAt="2026-03-01T09:00:00Z" />)
  expect(screen.getByRole('status')).toHaveTextContent('Не вдалося підтвердити актуальність')
  expect(screen.getByText(/1 березня 2026/).closest('time')).toHaveAttribute(
    'datetime',
    '2026-03-01T09:00:00Z',
  )
})
