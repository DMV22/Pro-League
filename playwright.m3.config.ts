import { execFileSync } from 'node:child_process'
import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'
import { assertM3AcceptanceTarget } from './scripts/db/m3-acceptance-fixture'

assertM3AcceptanceTarget(process.env.DATABASE_URL, process.env.M3_ACCEPTANCE_CONFIRM_DB)
if (
  process.env.PUBLIC_M3_ACCEPTANCE_FIXTURE !== '1' ||
  process.env.PUBLIC_NAVIGATION_TEST_FIXTURE !== '1' ||
  process.env.DATABASE_URL !== process.env.M3_ACCEPTANCE_DATABASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.PUBLIC_CACHE_BROWSER_FIXTURE ||
  process.env.PUBLIC_PREVIEW_GUARD_FIXTURE ||
  process.env.PUBLIC_PREVIEW_SMOKE
)
  throw new Error('M3 milestone requires its explicit local fixture and fresh production server')

// Playwright concatenates webServer entries when merging configs; inherit only one server.
export default defineConfig(
  { ...base, webServer: undefined },
  {
    testMatch: [
      '**/e2e/public-navigation.spec.ts',
      '**/e2e/public-season-content.spec.ts',
      '**/e2e/public-published-only.spec.ts',
      '**/accessibility/public-navigation.a11y.spec.ts',
    ],
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    outputDir: 'artifacts/m3-browser/test-results',
    globalSetup: './tests/support/m3-browser-versions.ts',
    metadata: {
      candidateSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      workingTreeDirty: Boolean(
        execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      ),
      workflowRunUrl: process.env.GITHUB_RUN_ID
        ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
      workflowSha: process.env.GITHUB_SHA ?? null,
    },
    reporter: [
      ['line'],
      ['html', { open: 'never', outputFolder: 'artifacts/m3-browser/html' }],
      ['json', { outputFile: 'artifacts/m3-browser/results.json' }],
      ['./tests/support/m3-browser-reporter.ts'],
    ],
    use: { trace: 'on', video: 'off', screenshot: 'only-on-failure' },
    webServer: {
      command: 'pnpm start:test',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
  },
)
