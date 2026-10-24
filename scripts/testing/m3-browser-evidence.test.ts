import { describe, expect, it } from 'vitest'
import { m3EvidenceFailures, m3Files, m3Projects, type M3BrowserCase } from './m3-browser-evidence'

function passingMatrix(): M3BrowserCase[] {
  return m3Projects.flatMap((project) =>
    Object.entries(m3Files).flatMap(([file, count]) =>
      Array.from({ length: count }, (_, index) => ({
        project,
        file,
        title: `${file} ${index}`,
        expectedStatus: 'passed',
        results: ['passed'],
        annotations: [],
      })),
    ),
  )
}

describe('M3 browser evidence gate', () => {
  it('accepts the complete 56-case matrix', () => {
    const cases = passingMatrix()
    expect(cases).toHaveLength(56)
    expect(m3EvidenceFailures(cases)).toEqual([])
  })
  it('rejects no tests, filtered subsets and missing engines', () => {
    expect(m3EvidenceFailures([])).not.toEqual([])
    expect(m3EvidenceFailures(passingMatrix().slice(1))).not.toEqual([])
    expect(
      m3EvidenceFailures(passingMatrix().filter((test) => test.project !== 'webkit')),
    ).not.toEqual([])
  })
  it.each(['skipped', 'failed', 'timedOut', 'interrupted'])('rejects a %s case', (status) => {
    const cases = passingMatrix()
    cases[0].results = [status]
    expect(m3EvidenceFailures(cases)).not.toEqual([])
  })
  it('rejects expected failures and a passing retry', () => {
    const cases = passingMatrix()
    cases[0].expectedStatus = 'failed'
    cases[0].results = ['failed']
    expect(m3EvidenceFailures(cases)).not.toEqual([])
    cases[0].expectedStatus = 'passed'
    cases[0].results = ['failed', 'passed']
    expect(m3EvidenceFailures(cases)).not.toEqual([])
  })
  it('rejects duplicate cases and unexpected files', () => {
    const cases = passingMatrix()
    cases[1] = { ...cases[0] }
    expect(m3EvidenceFailures(cases)).not.toEqual([])
    expect(
      m3EvidenceFailures([
        ...passingMatrix(),
        { ...passingMatrix()[0], file: 'toString', title: 'unexpected file' },
      ]),
    ).not.toEqual([])
  })
  it.each(['skip', 'fixme', 'fail'])(
    'rejects a %s annotation despite a passed result',
    (annotation) => {
      const cases = passingMatrix()
      cases[0].annotations = [annotation]
      expect(m3EvidenceFailures(cases)).not.toEqual([])
    },
  )
})
