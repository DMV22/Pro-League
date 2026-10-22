import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const configPath = require.resolve('../../lighthouserc.cjs')

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
