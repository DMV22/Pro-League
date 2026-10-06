export const appLocale = {
  htmlLanguage: 'uk',
  intlLocale: 'uk-UA',
  timeZone: 'Europe/Kyiv',
} as const

export const openGraphLocale = 'uk_UA'

const dateFormatter = new Intl.DateTimeFormat(appLocale.intlLocale, {
  dateStyle: 'long',
  timeZone: appLocale.timeZone,
})

const dateTimeFormatter = new Intl.DateTimeFormat(appLocale.intlLocale, {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: appLocale.timeZone,
})

type DateInput = Date | number | string

function toDate(value: DateInput) {
  return value instanceof Date ? value : new Date(value)
}

export function formatAppDate(value: DateInput) {
  return dateFormatter.format(toDate(value))
}

export function formatAppDateTime(value: DateInput) {
  return dateTimeFormatter.format(toDate(value))
}
