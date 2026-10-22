import { createRequire } from 'node:module'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const configPath = require.resolve('../../lighthouserc.cjs')

beforeEach(() => vi.stubEnv('LHCI_PREVIEW_PERFORMANCE', ''))

afterEach(() => {
  vi.unstubAllEnvs()
  delete require.cache[configPath]
})

function configFor(origin: string) {
  vi.stubEnv('LHCI_BASE_URL', origin)
  delete require.cache[configPath]
  return require(configPath).ci
}

it('saves traces for the measured Preview runs without changing their budgets', () => {
  const ci = configFor('https://pro-league-development-pr-106.onrender.com')
  expect(ci.collect.settings.saveAssets).toBe(true)
  expect(ci.collect.numberOfRuns).toBe(3)
  expect(ci.collect.settings.throttlingMethod).toBeUndefined()
  expect(ci.collect.settings.formFactor).toBeUndefined()
  expect(ci.collect.url).toEqual([
    'https://pro-league-development-pr-106.onrender.com/',
    'https://pro-league-development-pr-106.onrender.com/admin',
  ])
  const budgets = ci.assert.assertMatrix[0].assertions
  expect(budgets['categories:performance']).toEqual([
    'error',
    { aggregationMethod: 'median', minScore: 0.9 },
  ])
  expect(budgets['largest-contentful-paint'][1].maxNumericValue).toBe(2500)
  expect(budgets['total-blocking-time'][1].maxNumericValue).toBe(200)
  expect(budgets['cumulative-layout-shift'][1].maxNumericValue).toBe(0.1)
})

it.each(['http://127.0.0.1:3200', 'https://pro-league-development.onrender.com'])(
  'does not enable trace capture for %s',
  (origin) => {
    expect(configFor(origin).collect.settings.saveAssets).toBeUndefined()
  },
)

it('only downgrades Performance/LCP/TBT for explicitly opted-in cloud Previews', () => {
  vi.stubEnv('LHCI_PREVIEW_PERFORMANCE', 'diagnostic')
  const ci = configFor('https://pro-league-development-pr-106.onrender.com')
  for (const matrix of ci.assert.assertMatrix) {
    expect(matrix.assertions['categories:performance'][0]).toBe('warn')
    expect(matrix.assertions['categories:accessibility']).toEqual([
      'error',
      { aggregationMethod: 'median', minScore: 1 },
    ])
    expect(matrix.assertions['categories:best-practices'][0]).toBe('error')
    expect(matrix.assertions['cumulative-layout-shift']).toEqual([
      'error',
      { aggregationMethod: 'median', maxNumericValue: 0.1 },
    ])
  }
  const home = ci.assert.assertMatrix[0].assertions
  expect(home['largest-contentful-paint']).toEqual([
    'warn',
    { aggregationMethod: 'median', maxNumericValue: 2500 },
  ])
  expect(home['total-blocking-time']).toEqual([
    'warn',
    { aggregationMethod: 'median', maxNumericValue: 200 },
  ])
  expect(ci.collect.settings.saveAssets).toBe(true)
  expect(ci.collect.numberOfRuns).toBe(3)
})

it.each([
  '',
  'http://127.0.0.1:3200',
  'https://pro-league-development.onrender.com',
  'https://example.com',
  'https://pro-league-development-pr-106.onrender.com.example.com',
])('keeps baseline and non-Preview budgets strict despite opt-in (%s)', (origin) => {
  vi.stubEnv('LHCI_PREVIEW_PERFORMANCE', 'diagnostic')
  const ci = configFor(origin)
  for (const matrix of ci.assert.assertMatrix) {
    expect(matrix.assertions['categories:performance'][0]).toBe('error')
    expect(matrix.assertions['categories:seo']?.[0]).toBe(
      matrix === ci.assert.assertMatrix[0] ? 'error' : undefined,
    )
  }
  const home = ci.assert.assertMatrix[0].assertions
  expect(home['largest-contentful-paint'][0]).toBe('error')
  expect(home['total-blocking-time'][0]).toBe('error')
})

it('does not accept an unknown diagnostic mode', () => {
  vi.stubEnv('LHCI_PREVIEW_PERFORMANCE', 'true')
  expect(
    configFor('https://pro-league-development-pr-106.onrender.com').assert.assertMatrix[0]
      .assertions['largest-contentful-paint'][0],
  ).toBe('error')
})
