import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cloudInputs,
  inspectCloudTarget,
  validateCloudTarget,
  repository,
} from './m3-cloud-target.mjs'
import { verifyBrowserReport, verifyLighthouse, verifyTraceInventory } from './m3-cloud-summary.mjs'

const sha = 'a'.repeat(40)
const input = cloudInputs('117', sha, '123')
function metadata() {
  return [
    input,
    {
      state: 'open',
      base: { ref: 'develop', sha: 'b'.repeat(40), repo: { full_name: repository } },
      head: { sha, repo: { full_name: repository } },
    },
    {
      repository: { full_name: repository },
      head_sha: sha,
      path: '.github/workflows/preview-lifecycle.yml',
      event: 'pull_request_target',
      status: 'completed',
      conclusion: 'success',
    },
    [{ name: 'reconcile', conclusion: 'success' }],
    [{ id: 1, name: 'isolated-preview-lighthouse-117-123', expired: false, size_in_bytes: 100 }],
    { status: 'ahead', files: [{ filename: 'public/m3-acceptance-pilot.txt', status: 'added' }] },
    [{ sha, environment: 'pilot PR #117' }],
  ]
}
test('accepts exact same-repo marker-only pilot and completed controller', () => {
  assert.equal(validateCloudTarget(...metadata()).artifactId, 1)
})
for (const [name, change] of [
  [
    'closed PR',
    (data) => {
      data[1].state = 'closed'
    },
  ],
  [
    'fork',
    (data) => {
      data[1].head.repo.full_name = 'other/repo'
    },
  ],
  [
    'changed SHA',
    (data) => {
      data[1].head.sha = 'c'.repeat(40)
    },
  ],
  [
    'unreviewed base',
    (data) => {
      data[1].base.ref = 'other'
    },
  ],
  [
    'failed controller',
    (data) => {
      data[2].conclusion = 'failure'
    },
  ],
  [
    'wrong workflow',
    (data) => {
      data[2].path = '.github/workflows/other.yml'
    },
  ],
  [
    'missing reconcile',
    (data) => {
      data[3] = []
    },
  ],
  [
    'expired artifact',
    (data) => {
      data[4][0].expired = true
    },
  ],
  [
    'missing artifact',
    (data) => {
      data[4] = []
    },
  ],
  [
    'oversized artifact',
    (data) => {
      data[4][0].size_in_bytes = 101 * 1024 * 1024
    },
  ],
  [
    'runtime change',
    (data) => {
      data[5].files[0].filename = 'src/app/page.tsx'
    },
  ],
  [
    'missing deployment',
    (data) => {
      data[6] = []
    },
  ],
])
  test(`rejects ${name}`, () => {
    const data = metadata()
    change(data)
    assert.throws(() => validateCloudTarget(...data))
  })
test('rejects malformed inputs before network or filesystem use', () => {
  for (const pr of ['0', '-1', '117/path', '1\norigin=bad'])
    assert.throws(() => cloudInputs(pr, sha, '123'))
  assert.throws(() => cloudInputs('117', 'bad', '123'))
  assert.throws(() => cloudInputs('117', sha, '123?other'))
})

test('refuses non-main invocation before any network request', async () => {
  let calls = 0
  await assert.rejects(() =>
    inspectCloudTarget({ GITHUB_REF: 'refs/heads/pilot' }, async () => {
      calls++
      throw new Error('unexpected request')
    }),
  )
  assert.equal(calls, 0)
})

test('checks exact deployment URL with read-only metadata requests', async () => {
  const [target, pr, run, jobs, artifacts, comparison, deployments] = metadata()
  deployments[0].id = 99
  const env = {
    GITHUB_REF: 'refs/heads/main',
    M3_PR: String(target.pr),
    M3_SHA: sha,
    M3_CONTROLLER_RUN: target.run,
    GH_TOKEN: 'test-token',
  }
  const documents = [
    pr,
    run,
    { jobs },
    { artifacts },
    comparison,
    deployments,
    [{ state: 'success', environment_url: 'https://other.example/' }],
  ]
  let calls = 0
  const fetcher = async (url, options) => {
    assert(url.startsWith(`https://api.github.com/repos/${repository}/`))
    assert.equal(options.method, undefined)
    assert.equal(options.redirect, 'error')
    const data = documents[calls++]
    return { ok: true, json: async () => data }
  }
  await assert.rejects(() => inspectCloudTarget(env, fetcher), /exact Preview origin/)
  documents[6][0].environment_url = input.origin
  calls = 0
  assert.equal((await inspectCloudTarget(env, fetcher)).origin, input.origin)
})

function browserReport() {
  return {
    errors: [],
    suites: [
      {
        specs: [
          'e2e/public-navigation.spec.ts',
          'accessibility/public-navigation.a11y.spec.ts',
        ].flatMap((file) =>
          Array.from({ length: 3 }, (_, index) => ({
            file,
            title: `case ${index}`,
            tests: ['chromium', 'chromium-mobile'].map((projectName) => ({
              projectName,
              annotations: [],
              expectedStatus: 'passed',
              results: [
                { status: 'passed', retry: 0, attachments: [{ name: 'trace', path: 'trace.zip' }] },
              ],
            })),
          })),
        ),
      },
    ],
  }
}
test('accepts exactly 12 browser cases', () =>
  assert.equal(verifyBrowserReport(browserReport()).cases, 12))
test('rejects a missing browser trace', () => {
  const report = browserReport()
  report.suites[0].specs[0].tests[0].results[0].attachments = []
  assert.throws(() => verifyBrowserReport(report))
})
test('requires raw Lighthouse trace and network assets', () => {
  const files = Array.from({ length: 6 }, (_, index) => [
    `${index}.trace.json`,
    `${index}.devtoolslog.json`,
  ]).flat()
  assert.equal(verifyTraceInventory(files).traces.length, 6)
  assert.throws(() => verifyTraceInventory(files.slice(1)))
  assert.throws(() => verifyTraceInventory([]))
})
for (const [name, change] of [
  [
    'subset',
    (report) => {
      report.suites[0].specs.pop()
    },
  ],
  [
    'skip',
    (report) => {
      report.suites[0].specs[0].tests[0].results[0].status = 'skipped'
    },
  ],
  [
    'retry',
    (report) => {
      report.suites[0].specs[0].tests[0].results[0].retry = 1
    },
  ],
  [
    'quarantine',
    (report) => {
      report.suites[0].specs[0].tests[0].annotations.push({ type: 'fixme' })
    },
  ],
])
  test(`rejects browser ${name}`, () => {
    const report = browserReport()
    change(report)
    assert.throws(() => verifyBrowserReport(report))
  })

const url = `${input.origin}/`
function lighthouseReports() {
  return Array.from({ length: 3 }, () => ({
    finalDisplayedUrl: url,
    configSettings: { formFactor: 'mobile' },
    lighthouseVersion: '12.6.1',
    categories: {
      performance: { score: 0.5 },
      accessibility: { score: 1 },
      'best-practices': { score: 0.96 },
    },
    audits: Object.fromEntries(
      [
        ['cumulative-layout-shift', 0],
        ['largest-contentful-paint', 3500],
        ['total-blocking-time', 600],
      ].map(([key, numericValue]) => [key, { numericValue }]),
    ),
  }))
}
test('retains diagnostic Performance failures without a strict-pass claim', () => {
  assert.equal(
    verifyLighthouse(lighthouseReports(), [url])[0].performanceStatus,
    'diagnostic-exception-not-strict-pass',
  )
})
test('rejects incomplete Lighthouse collection and non-exempt CLS failures', () => {
  assert.throws(() => verifyLighthouse(lighthouseReports().slice(1), [url]))
  const reports = lighthouseReports()
  for (const report of reports) report.audits['cumulative-layout-shift'].numericValue = 0.2
  assert.throws(() => verifyLighthouse(reports, [url]))
})
test('rejects redirected, errored and missing Lighthouse metrics', () => {
  for (const change of [
    (report) => {
      report.finalDisplayedUrl = 'https://other.example/'
    },
    (report) => {
      report.runtimeError = { code: 'FAILED' }
    },
    (report) => {
      report.audits['total-blocking-time'].numericValue = null
    },
  ]) {
    const reports = lighthouseReports()
    change(reports[0])
    assert.throws(() => verifyLighthouse(reports, [url]))
  }
})
