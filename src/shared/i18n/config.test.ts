import { describe, expect, test } from 'vitest'

import { appLocale, formatAppDate, formatAppDateTime } from './config'

describe('Ukrainian presentation conventions', () => {
  test('uses the accepted locale and time zone', () => {
    expect(appLocale).toEqual({
      htmlLanguage: 'uk',
      intlLocale: 'uk-UA',
      timeZone: 'Europe/Kyiv',
    })
  })

  test('formats dates and times for the application locale', () => {
    const instant = new Date('2026-01-15T12:30:00.000Z')

    expect(formatAppDate(instant)).toBe('15 січня 2026 р.')
    expect(formatAppDateTime(instant)).toContain('14:30')
  })
})
