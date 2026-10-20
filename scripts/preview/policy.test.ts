import { describe, expect, it } from 'vitest'
import { planPreview, type PullRequest } from './policy'

export const pullRequest: PullRequest = {
  number: 120,
  repository: 'DMV22/Pro-League',
  headRepository: 'DMV22/Pro-League',
  base: 'develop',
  sha: 'a'.repeat(40),
  state: 'open',
}

describe('Preview allocation policy', () => {
  it('does not allocate resources for documentation-only changes', () => {
    expect(planPreview(pullRequest, ['docs/operations/preview.md', 'README.md'])).toEqual({
      kind: 'skip',
      reason: 'non-runtime',
    })
  })
  it('never provisions a fork or a PR targeting Production', () => {
    expect(
      planPreview({ ...pullRequest, headRepository: 'outsider/Pro-League' }, ['src/x.ts']),
    ).toEqual({ kind: 'skip', reason: 'untrusted-pr' })
    expect(planPreview({ ...pullRequest, base: 'main' }, ['src/x.ts'])).toEqual({
      kind: 'skip',
      reason: 'untrusted-pr',
    })
  })
  it('cleans a closed PR before considering file scope or capacity', () => {
    expect(planPreview({ ...pullRequest, state: 'closed' }, ['README.md'], { active: 2 })).toEqual({
      kind: 'cleanup',
    })
  })
  it('blocks a third allocation but lets an existing Preview reconcile', () => {
    expect(planPreview(pullRequest, ['src/x.ts'], { active: 2 })).toEqual({
      kind: 'blocked',
      reason: 'capacity',
    })
    expect(planPreview(pullRequest, ['src/x.ts'], { active: 2, existing: true })).toEqual({
      kind: 'prepare',
    })
  })
  it('does not allocate for test, workflow or agent-only changes', () => {
    expect(
      planPreview(pullRequest, [
        'tests/e2e/x.spec.ts',
        '.github/workflows/pr-baseline.yml',
        'skills-lock.json',
        'scripts/preview/policy.ts',
      ]),
    ).toEqual({ kind: 'skip', reason: 'non-runtime' })
  })
})
