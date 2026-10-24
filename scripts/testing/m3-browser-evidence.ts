export const m3Projects = ['chromium', 'chromium-mobile', 'firefox', 'webkit'] as const
export const m3Files = {
  'e2e/public-navigation.spec.ts': 3,
  'e2e/public-season-content.spec.ts': 2,
  'e2e/public-published-only.spec.ts': 6,
  'accessibility/public-navigation.a11y.spec.ts': 3,
} as const

export type M3BrowserCase = {
  project: string
  file: string
  title: string
  expectedStatus: string
  results: string[]
  annotations: string[]
}

/** A green subset, expected failure, retry or skipped/quarantined test is not acceptance. */
export function m3EvidenceFailures(cases: M3BrowserCase[]) {
  const failures: string[] = []
  const seen = new Set<string>()
  for (const project of m3Projects)
    for (const [file, count] of Object.entries(m3Files))
      if (cases.filter((test) => test.project === project && test.file === file).length !== count)
        failures.push(`Incomplete matrix: ${project}/${file} needs exactly ${count} tests`)
  for (const test of cases) {
    const identity = `${test.project}/${test.file}/${test.title}`
    if (seen.has(identity)) failures.push(`Duplicate required case: ${identity}`)
    seen.add(identity)
    if (
      !m3Projects.includes(test.project as (typeof m3Projects)[number]) ||
      !Object.hasOwn(m3Files, test.file) ||
      test.expectedStatus !== 'passed' ||
      test.results.length !== 1 ||
      test.results[0] !== 'passed' ||
      test.annotations.some((type) => ['skip', 'fixme', 'fail'].includes(type))
    )
      failures.push(
        `Required case did not pass once without quarantine: ${test.project}/${test.title}`,
      )
  }
  return failures
}
