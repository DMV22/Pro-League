import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export function verifyBrowserReport(report) {
  assert.deepEqual(report.errors, [], 'Browser runner errors')
  const cases = []
  const visit = (suite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests) cases.push({ ...test, file: spec.file, title: spec.title })
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites) visit(suite)
  assert(cases.length === 12, 'Expected all 12 cloud browser cases')
  const files = ['e2e/public-navigation.spec.ts', 'accessibility/public-navigation.a11y.spec.ts']
  const projects = ['chromium', 'chromium-mobile']
  for (const file of files)
    for (const project of projects)
      assert(
        cases.filter(
          (test) => test.file.replaceAll('\\', '/') === file && test.projectName === project,
        ).length === 3,
        'Incomplete cloud matrix',
      )
  const identities = new Set()
  for (const test of cases) {
    const identity = `${test.projectName}/${test.file}/${test.title}`
    assert(!identities.has(identity), 'Duplicate browser case')
    identities.add(identity)
    assert(test.expectedStatus === 'passed' && test.results.length === 1)
    assert(
      test.results[0].status === 'passed' && test.results[0].retry === 0,
      'Failed/skipped/retried case',
    )
    assert(
      test.results[0].attachments.some(
        (attachment) => attachment.name === 'trace' && attachment.path,
      ),
      'Missing browser trace attachment',
    )
    assert(!test.annotations.some(({ type }) => ['skip', 'fixme', 'fail'].includes(type)))
  }
  return { cases: cases.length, projects, retries: 0, skipped: 0 }
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const metric = (values) => {
  assert(values.every(Number.isFinite), 'Missing or invalid metric')
  return { median: median(values), min: Math.min(...values), max: Math.max(...values) }
}

export function verifyLighthouse(reports, urls) {
  assert(reports.length === urls.length * 3, 'Expected exactly three reports per URL')
  return urls.map((url) => {
    const rows = reports.filter((report) => report.finalDisplayedUrl === url)
    assert(rows.length === 3, 'Incomplete or redirected Lighthouse collection')
    assert(
      rows.every((report) => !report.runtimeError && report.configSettings.formFactor === 'mobile'),
    )
    const score = (category) => metric(rows.map((report) => report.categories[category].score))
    const audit = (name) => metric(rows.map((report) => report.audits[name].numericValue))
    const accessibility = score('accessibility')
    const bestPractices = score('best-practices')
    const cls = audit('cumulative-layout-shift')
    assert(
      accessibility.median >= 1 && bestPractices.median >= 0.9 && cls.median <= 0.1,
      'Non-exempt Lighthouse assertion failed',
    )
    return {
      url,
      performanceStatus: 'diagnostic-exception-not-strict-pass',
      performance: score('performance'),
      lcpMs: audit('largest-contentful-paint'),
      tbtMs: audit('total-blocking-time'),
      cls,
      accessibility,
      bestPractices,
      versions: [...new Set(rows.map((report) => report.lighthouseVersion))],
      conditions: rows.map((report) => ({
        fetchedAt: report.fetchTime,
        settings: report.configSettings,
        environment: report.environment,
      })),
    }
  })
}

function readReports(directory) {
  const reports = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) reports.push(...readReports(path))
    else if (entry.name.endsWith('.json') && !/trace|devtoolslog/.test(entry.name)) {
      const value = JSON.parse(readFileSync(path, 'utf8'))
      if (value.lighthouseVersion) reports.push(value)
    }
  }
  return reports
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)],
  )
}

export function verifyTraceInventory(files) {
  const traces = files.filter((file) => file.endsWith('.trace.json'))
  const networkLogs = files.filter((file) => file.endsWith('.devtoolslog.json'))
  assert(
    traces.length >= 6 && networkLogs.length >= 6,
    'Missing raw Lighthouse trace/network assets',
  )
  return { traces, networkLogs }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = 'artifacts/m3-cloud'
  const read = (name) => JSON.parse(readFileSync(`${root}/${name}.json`, 'utf8'))
  const before = read('target-before')
  const after = read('target-after')
  for (const key of ['pr', 'sha', 'baseline', 'origin', 'artifactId'])
    assert(before[key] === after[key], 'Target changed during collection')
  const origin = before.origin
  const browser = read('browser')
  const visit = (suite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests)
        for (const result of test.results)
          for (const attachment of result.attachments ?? [])
            if (attachment.name === 'trace') {
              const path = resolve(attachment.path)
              assert(
                path.startsWith(resolve(`${root}/browser-traces`) + sep) && existsSync(path),
                'Browser trace file unavailable',
              )
            }
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of browser.suites) visit(suite)
  const routeAssets = [
    ...filesIn('.lighthouseci'),
    ...readdirSync('.').filter((file) => /\.(trace|devtoolslog)\.json$/.test(file)),
  ]
  const summary = {
    scope: 'M3 cloud evidence; not final owner acceptance or cleanup proof',
    status: 'passed',
    target: before,
    versions: read('versions'),
    recheckedAt: after.checkedAt,
    browser: verifyBrowserReport(browser),
    rawAssets: {
      controller: verifyTraceInventory(filesIn(`${root}/controller`)),
      routes: verifyTraceInventory(routeAssets),
    },
    controller: verifyLighthouse(readReports(`${root}/controller`), [
      `${origin}/`,
      `${origin}/admin`,
    ]),
    routes: verifyLighthouse(readReports(`${root}/routes`), [
      `${origin}/competitions/golden-cup`,
      `${origin}/competitions/golden-cup/seasons/2026-golden`,
    ]),
  }
  writeFileSync(`${root}/acceptance.json`, JSON.stringify(summary, null, 2))
  console.info(
    'Complete M3 cloud evidence passed; Performance remains diagnostic, not strict pass.',
  )
}
