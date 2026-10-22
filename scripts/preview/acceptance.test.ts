import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { acceptanceMode, recreationExpiry, withAcceptanceFailure } from './acceptance'
import {
  cleanupPreview,
  reconcilePreview,
  type PreviewRecord,
  type PreviewSystems,
} from './reconcile'
import { AllocationBlockedError, createGitHub } from './providers/github'
import { createStateCodec } from './state'
import type { PullRequest } from './policy'

const pr: PullRequest = {
  number: 112,
  repository: 'DMV22/Pro-League',
  headRepository: 'DMV22/Pro-League',
  base: 'develop',
  sha: 'f07f84df761a650de66667be00f18721eea78183',
  state: 'open',
}
const branch = 'codex/m3-preview-safety-pilot'
const now = new Date('2026-10-23T12:00:00.987Z')
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REPOSITORY: pr.repository,
  GITHUB_WORKFLOW_REF: `${pr.repository}/.github/workflows/preview-lifecycle.yml@refs/heads/main`,
  GITHUB_WORKFLOW_SHA: 'a'.repeat(40),
}

it('wires explicit manual choices, trusted checkout, serialization and a credential-free probe', () => {
  const workflow = parse(
    readFileSync(new URL('../../.github/workflows/preview-lifecycle.yml', import.meta.url), 'utf8'),
  )
  expect(workflow.on.workflow_dispatch.inputs.operation.options).toEqual([
    'run',
    'recreate',
    'recreate-short-ttl',
    'test-cleanup-failure',
    'test-allocation-block',
  ])
  expect(workflow.concurrency['cancel-in-progress']).toBe(false)
  expect(workflow.jobs.reconcile.concurrency.group).toBe('isolated-preview-mutations')
  const checkout = workflow.jobs.reconcile.steps.find((step: { uses?: string }) =>
    step.uses?.startsWith('actions/checkout@'),
  )
  expect(checkout.with.ref).toBe('${{ github.workflow_sha }}')
  const inspect = workflow.jobs.inspect.steps.find((step: { id?: string }) => step.id === 'plan')
  expect(inspect.env.PREVIEW_OPERATION).toBe("${{ inputs.operation || 'run' }}")
  const execute = workflow.jobs.reconcile.steps.find(
    (step: { env?: { OPERATION?: string } }) => step.env?.OPERATION,
  )
  for (const key of ['NEON_API_KEY', 'RENDER_API_KEY']) {
    expect(execute.env[key]).toBe(
      `\${{ inputs.operation != 'test-allocation-block' && secrets.${key} || '' }}`,
    )
  }
})

it.each(['recreate-short-ttl', 'test-cleanup-failure', 'test-allocation-block'])(
  'admits only the pinned pilot for %s',
  (command) => {
    expect(acceptanceMode(command, pr, branch, env, now)).toBe(command)
  },
)

it.each([
  { GITHUB_ACTIONS: 'false' },
  { GITHUB_EVENT_NAME: 'pull_request_target' },
  { GITHUB_EVENT_NAME: 'schedule' },
  { GITHUB_REPOSITORY: 'other/repo' },
  { GITHUB_WORKFLOW_REF: env.GITHUB_WORKFLOW_REF.replace('main', 'develop') },
  { GITHUB_WORKFLOW_REF: env.GITHUB_WORKFLOW_REF.replace('lifecycle', 'reconcile') },
  { GITHUB_WORKFLOW_SHA: '' },
])('rejects an untrusted acceptance context %j', (change) => {
  expect(() =>
    acceptanceMode('recreate-short-ttl', pr, branch, { ...env, ...change }, now),
  ).toThrow('restricted')
})

it.each([
  { number: 113 },
  { repository: 'other/repo' },
  { headRepository: 'fork/repo' },
  { base: 'main' },
  { sha: 'b'.repeat(40) },
])('rejects a different pilot identity %j', (change) => {
  expect(() =>
    acceptanceMode('test-cleanup-failure', { ...pr, ...change }, branch, env, now),
  ).toThrow('restricted')
})

it('rejects another branch, elapsed deadline, invalid clock and closed recreation', () => {
  expect(() => acceptanceMode('recreate-short-ttl', pr, 'another-branch', env, now)).toThrow()
  expect(() =>
    acceptanceMode('recreate-short-ttl', pr, branch, env, new Date('2026-10-30T00:00:00Z')),
  ).toThrow()
  expect(() => acceptanceMode('recreate-short-ttl', pr, branch, env, new Date(NaN))).toThrow()
  expect(() =>
    acceptanceMode('recreate-short-ttl', { ...pr, state: 'closed' }, branch, env, now),
  ).toThrow()
})

it('keeps ordinary operations and seven-day recreation unchanged', () => {
  expect(acceptanceMode('run', pr, branch, env, now)).toBeUndefined()
  expect(recreationExpiry(now)).toBe('2026-10-30T12:00:00.000Z')
  expect(recreationExpiry(now, 'recreate-short-ttl')).toBe('2026-10-23T12:30:00.000Z')
  const systems = {} as PreviewSystems
  expect(withAcceptanceFailure(undefined, systems)).toBe(systems)
  expect(withAcceptanceFailure('recreate-short-ttl', systems)).toBe(systems)
})

function alertProvider() {
  const issues: { body: string }[] = []
  const post = vi.fn(async (_path: string, body: { body: string }) => {
    issues.push(body)
  })
  const github = createGitHub(
    { get: vi.fn(async () => issues), post } as never,
    createStateCodec('12'.repeat(32)),
  )
  return { github, issues, post }
}

it('deduplicates the real cleanup alert and blocks the shared allocation guard until resolved', async () => {
  const { github, issues, post } = alertProvider()
  await github.assertAllocationAllowed()
  await github.alert(pr)
  await github.alert(pr)
  expect(post).toHaveBeenCalledTimes(1)
  expect(issues[0].body).toContain('closed or its signed reservation has expired')
  await expect(github.assertAllocationAllowed()).rejects.toBeInstanceOf(AllocationBlockedError)
  issues.length = 0
  await github.assertAllocationAllowed()
  issues.push({ body: '<!-- preview-inventory-failure -->' })
  await expect(github.assertAllocationAllowed()).rejects.toBeInstanceOf(AllocationBlockedError)
})

it('does not mistake a provider error for an allocation refusal', async () => {
  const failure = new Error('unavailable')
  const github = createGitHub(
    {
      get: async () => {
        throw failure
      },
    } as never,
    createStateCodec('12'.repeat(32)),
  )
  await expect(github.assertAllocationAllowed()).rejects.toBe(failure)
  expect(failure).not.toBeInstanceOf(AllocationBlockedError)
})

it('exercises the real expired cleanup catch twice without deletion or changing signed state', async () => {
  const { github, post, issues } = alertProvider()
  const codec = createStateCodec('12'.repeat(32))
  let clock = now
  let body = codec.encode({
    pr: pr.number,
    sha: pr.sha,
    phase: 'ready',
    expiresAt: recreationExpiry(now, 'recreate-short-ttl'),
  })
  const original = body
  const remove = vi.fn(async () => undefined)
  const database = vi.fn()
  const status = vi.fn(async () => undefined)
  const systems: PreviewSystems = {
    current: async () => pr,
    record: async () => codec.decode(body, pr.number),
    save: async (record: PreviewRecord) => {
      body = codec.encode(record)
    },
    now: () => clock,
    remove,
    database,
    files: async () => ['public/preview-safety-pilot.txt'],
    prepare: vi.fn(),
    bind: vi.fn(),
    verify: vi.fn(),
    status,
    alert: github.alert,
  }
  const failure = withAcceptanceFailure('test-cleanup-failure', systems)
  await expect(cleanupPreview(pr, failure, 'expired')).rejects.toThrow('Only an expired')
  expect(post).not.toHaveBeenCalled()
  clock = new Date('2026-10-23T12:30:00Z')
  await expect(cleanupPreview(pr, failure, 'expired')).rejects.toThrow('operator action')
  await expect(cleanupPreview(pr, failure, 'expired')).rejects.toThrow('operator action')
  expect(post).toHaveBeenCalledTimes(1)
  expect(remove).not.toHaveBeenCalled()
  expect(body).toBe(original)
  await expect(reconcilePreview(pr, systems)).rejects.toThrow('explicit operator recreation')
  expect(database).not.toHaveBeenCalled()
  await cleanupPreview(pr, systems, 'expired')
  expect(remove).toHaveBeenCalledTimes(1)
  expect(codec.decode(body, pr.number).phase).toBe('cleaned')
  expect(status).toHaveBeenCalledWith(
    pr,
    'failure',
    'Preview expired; explicit operator recreation required',
  )
  await cleanupPreview(pr, systems, 'expired')
  expect(remove).toHaveBeenCalledTimes(1)
  await expect(reconcilePreview(pr, systems)).rejects.toThrow('explicit operator recreation')
  // Cleanup does not silently resolve an operations alert.
  expect(issues).toHaveLength(1)
})

it('refuses readiness if a reservation expires during preparation', async () => {
  let record: PreviewRecord | undefined
  let clock = now
  const status = vi.fn(async () => undefined)
  const systems: PreviewSystems = {
    current: async () => pr,
    files: async () => ['public/preview-safety-pilot.txt'],
    record: async () => record,
    save: async (value) => {
      record = { ...value }
    },
    now: () => clock,
    database: vi.fn(),
    prepare: vi.fn(),
    bind: async () => ({ serviceId: 'srv-preview112', deployId: 'dep-preview112' }),
    verify: async () => {
      clock = new Date('2026-10-30T12:00:00Z')
    },
    remove: vi.fn(),
    alert: vi.fn(),
    status,
  }
  await expect(reconcilePreview(pr, systems)).rejects.toThrow('no reset')
  expect(record?.phase).toBe('prepared')
  expect(status).not.toHaveBeenCalledWith(pr, 'success', expect.anything())
})
