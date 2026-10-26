import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const cli = require.resolve('@lhci/cli/src/cli.js')
const config = fileURLToPath(new URL('../../lighthouserc.cjs', import.meta.url))
const origin = 'https://pro-league-development-pr-106.onrender.com'

it.each([
  { mode: 'diagnostic', accessibility: 1, cls: 0, exit: 0 },
  { mode: '', accessibility: 1, cls: 0, exit: 1 },
  { mode: 'diagnostic', accessibility: 0.5, cls: 0, exit: 1 },
  { mode: 'diagnostic', accessibility: 1, cls: 0.5, exit: 1 },
])(
  'uses real LHCI exit semantics for $mode, accessibility=$accessibility, CLS=$cls',
  (scenario) => {
    const root = realpathSync(tmpdir())
    const directory = mkdtempSync(join(root, 'proleague-lhci-assert-'))
    try {
      const report = join(directory, 'report.json')
      writeFileSync(
        report,
        JSON.stringify({
          finalUrl: `${origin}/`,
          categories: {
            performance: { score: 0.5 },
            accessibility: { score: scenario.accessibility },
            'best-practices': { score: 1 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 6000 },
            'total-blocking-time': { numericValue: 1000 },
            'cumulative-layout-shift': { numericValue: scenario.cls },
          },
        }),
      )
      const result = spawnSync(
        process.execPath,
        [cli, 'assert', `--config=${config}`, `--lhr=${report}`],
        {
          cwd: directory,
          env: {
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
            NODE_ENV: 'production',
            CI: 'true',
            LHCI_BASE_URL: origin,
            LHCI_PREVIEW_PERFORMANCE: scenario.mode,
          },
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true,
        },
      )
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(scenario.exit)
      const assertions = JSON.parse(
        readFileSync(join(directory, '.lighthouseci/assertion-results.json'), 'utf8'),
      )
      expect(
        assertions.some(
          (entry: { auditId: string; passed: boolean }) =>
            entry.auditId === 'largest-contentful-paint' && !entry.passed,
        ),
      ).toBe(true)
    } finally {
      // Delete only this test's newly-created child directory, never a shared temp root.
      const child = relative(root, resolve(directory))
      if (child.startsWith('proleague-lhci-assert-') && !child.includes('..')) {
        rmSync(directory, { recursive: true, force: true })
      }
    }
  },
  35_000,
)
