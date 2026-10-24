import { mkdirSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter'
import { m3EvidenceFailures } from '../../scripts/testing/m3-browser-evidence'

export default class M3BrowserReporter implements Reporter {
  private suite?: Suite
  private metadata?: FullConfig['metadata']

  onBegin(config: FullConfig, suite: Suite) {
    this.suite = suite
    this.metadata = config.metadata
  }

  async onEnd(result: FullResult) {
    const cases = (this.suite?.allTests() ?? []).map((test) => ({
      project: test.parent.project()?.name ?? '',
      file: relative('tests', test.location.file).replaceAll('\\', '/'),
      title: test.title,
      expectedStatus: test.expectedStatus,
      results: test.results.map((run) => run.status),
      annotations: test.annotations.map((annotation) => annotation.type),
    }))
    const failures = m3EvidenceFailures(cases)
    if (result.status !== 'passed') failures.push(`Playwright run: ${result.status}`)
    const status = failures.length ? 'failed' : 'passed'
    mkdirSync('artifacts/m3-browser', { recursive: true })
    writeFileSync(
      'artifacts/m3-browser/acceptance.json',
      JSON.stringify(
        {
          scope: 'M3 local/CI browser gate; not cloud, Lighthouse or final milestone approval',
          status,
          metadata: this.metadata,
          startedAt: result.startTime.toISOString(),
          durationMs: result.duration,
          failures,
          cases,
        },
        null,
        2,
      ),
    )
    for (const failure of failures) console.error(`M3 evidence: ${failure}`)
    return { status } as const
  }
}
