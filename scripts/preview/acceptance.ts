import type { PullRequest } from './policy'
import type { PreviewSystems } from './reconcile'

// Temporary issue #96 instrumentation. Remove after live evidence is recorded.
const pilotSha = 'f07f84df761a650de66667be00f18721eea78183'
const deadline = Date.parse('2026-10-30T00:00:00Z')
export type AcceptanceMode = 'recreate-short-ttl' | 'test-cleanup-failure' | 'test-allocation-block'
const modes: readonly string[] = [
  'recreate-short-ttl',
  'test-cleanup-failure',
  'test-allocation-block',
]

export function acceptanceMode(
  command: string,
  pr: PullRequest,
  branch: string,
  env: Readonly<Record<string, string | undefined>>,
  now: Date,
): AcceptanceMode | undefined {
  if (!modes.includes(command)) return undefined
  if (
    env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    env.GITHUB_REPOSITORY !== 'DMV22/Pro-League' ||
    env.GITHUB_WORKFLOW_REF !==
      'DMV22/Pro-League/.github/workflows/preview-lifecycle.yml@refs/heads/main' ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_WORKFLOW_SHA ?? '') ||
    !Number.isFinite(now.getTime()) ||
    now.getTime() >= deadline ||
    pr.number !== 112 ||
    pr.repository !== 'DMV22/Pro-League' ||
    pr.headRepository !== pr.repository ||
    pr.base !== 'develop' ||
    pr.sha !== pilotSha ||
    branch !== 'codex/m3-preview-safety-pilot' ||
    (command === 'recreate-short-ttl' && pr.state !== 'open')
  )
    throw new Error('Acceptance operation is restricted to the pinned manual pilot')
  return command as AcceptanceMode
}

export function recreationExpiry(now: Date, mode?: AcceptanceMode) {
  const lifetime = mode === 'recreate-short-ttl' ? 30 * 60_000 : 7 * 86400_000
  return new Date(Math.floor(now.getTime() / 1000) * 1000 + lifetime).toISOString()
}

export function withAcceptanceFailure(mode: AcceptanceMode | undefined, systems: PreviewSystems) {
  if (mode !== 'test-cleanup-failure') return systems
  return {
    ...systems,
    async remove() {
      // Reach the real cleanup catch/alert path without issuing any provider deletion.
      console.info('Acceptance pilot #112: simulated cleanup failure before provider deletion')
      throw new Error('Acceptance cleanup failure')
    },
  } satisfies PreviewSystems
}
