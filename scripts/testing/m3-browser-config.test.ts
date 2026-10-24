import { afterEach, describe, expect, it, vi } from 'vitest'
import { m3Projects } from './m3-browser-evidence'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('M3 Playwright configuration', () => {
  it('starts exactly one server and preserves the complete no-retry matrix', async () => {
    const url = 'postgresql://test:fake@127.0.0.1/proleague_m3_acceptance_ci'
    vi.stubEnv('DATABASE_URL', url)
    vi.stubEnv('M3_ACCEPTANCE_DATABASE_URL', url)
    vi.stubEnv('M3_ACCEPTANCE_CONFIRM_DB', 'proleague_m3_acceptance_ci')
    vi.stubEnv('PUBLIC_M3_ACCEPTANCE_FIXTURE', '1')
    vi.stubEnv('PUBLIC_NAVIGATION_TEST_FIXTURE', '1')
    for (const key of [
      'PLAYWRIGHT_BASE_URL',
      'PUBLIC_CACHE_BROWSER_FIXTURE',
      'PUBLIC_PREVIEW_GUARD_FIXTURE',
      'PUBLIC_PREVIEW_SMOKE',
    ])
      vi.stubEnv(key, undefined)
    const { default: config } = await import('../../playwright.m3.config')
    const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer]
    expect(servers).toHaveLength(1)
    expect(servers[0]?.reuseExistingServer).toBe(false)
    expect(config.projects?.map((project) => project.name)).toEqual(m3Projects)
    expect(config.retries).toBe(0)
    expect(config.workers).toBe(1)
    expect(config.forbidOnly).toBe(true)
  })

  it('refuses a missing explicit fixture before tests are selected', async () => {
    vi.stubEnv('DATABASE_URL', undefined)
    await expect(import('../../playwright.m3.config')).rejects.toThrow('dedicated loopback')
  })
})
