import { expect, it, vi } from 'vitest'
import {
  cleanupPreview,
  createReservation,
  reconcilePreview,
  type PreviewRecord,
  type PreviewSystems,
} from './reconcile'
import { AllocationBlockedError, createGitHub } from './providers/github'
import { createStateCodec } from './state'
import type { PullRequest } from './policy'

const pr: PullRequest = {
  number: 120,
  repository: 'DMV22/Pro-League',
  headRepository: 'DMV22/Pro-League',
  base: 'develop',
  sha: 'a'.repeat(40),
  state: 'open',
}
const now = new Date('2026-10-23T12:00:00.987Z')

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

function cloud(initial?: PreviewRecord) {
  const codec = createStateCodec('12'.repeat(32))
  const alerts = alertProvider()
  let current = { ...pr }
  let clock = now
  let body = initial ? codec.encode(initial) : undefined
  let unavailable = false
  const resources = new Set(initial && initial.phase !== 'cleaned' ? [pr.number] : [])
  const identity = {
    projectId: 'long-sea-15202409',
    parentBranchId: 'br-divine-leaf-b90tlpj2',
    branchId: 'br-test120',
    endpointId: 'ep-test120',
    directHost: 'ep-test120.c-7.eu-central-1.aws.neon.tech',
    pullRequest: pr.number,
    database: 'proleague_golden_seed_pr_120',
  }
  const database = vi.fn(async () => {
    resources.add(pr.number)
    return identity
  })
  const remove = vi.fn(async () => {
    if (unavailable) throw new Error('provider unavailable')
    resources.delete(pr.number)
  })
  const status = vi.fn(async () => undefined)
  const systems: PreviewSystems = {
    current: async () => ({ ...current }),
    files: async () => ['src/app/page.tsx'],
    record: async () => (body ? codec.decode(body, pr.number) : undefined),
    save: async (record) => {
      body = codec.encode(record)
    },
    now: () => clock,
    database,
    remove,
    status,
    prepare: vi.fn(),
    bind: async () => ({ serviceId: 'srv-preview120', deployId: 'dep-preview120' }),
    verify: vi.fn(),
    alert: alerts.github.alert,
  }
  return {
    systems,
    ...alerts,
    resources,
    database,
    remove,
    status,
    snapshot: () => body,
    clock: (date: Date) => {
      clock = date
    },
    current: (value: PullRequest) => {
      current = value
    },
    outage: (value: boolean) => {
      unavailable = value
    },
  }
}

it('uses one fixed seven-day reservation for initial allocation and explicit recreation', async () => {
  const reservation = createReservation(pr, now)
  expect(reservation).toEqual({
    pr: pr.number,
    sha: pr.sha,
    phase: 'reserved',
    expiresAt: '2026-10-30T12:00:00.000Z',
  })
  const state = cloud()
  await reconcilePreview(pr, state.systems)
  expect((await state.systems.record(pr.number))?.expiresAt).toBe(reservation.expiresAt)
})

it('does not extend a reservation on retry or a new PR revision', async () => {
  const state = cloud()
  await reconcilePreview(pr, state.systems)
  state.clock(new Date('2026-10-24T12:00:00Z'))
  const next = { ...pr, sha: 'b'.repeat(40) }
  state.current(next)
  await reconcilePreview(next, state.systems)
  expect((await state.systems.record(pr.number))?.expiresAt).toBe('2026-10-30T12:00:00.000Z')
})

it('deduplicates cleanup alerts and blocks allocation until operator resolution', async () => {
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

it('does not mistake provider errors for the typed allocation refusal', async () => {
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

it('alerts on failed expired cleanup, preserves signed state and safely recovers', async () => {
  const state = cloud({ ...createReservation(pr, now), phase: 'ready' })
  await expect(cleanupPreview(pr, state.systems, 'expired')).rejects.toThrow('Only an expired')
  expect(state.post).not.toHaveBeenCalled()
  expect(state.remove).not.toHaveBeenCalled()
  const original = state.snapshot()
  state.clock(new Date('2026-10-30T12:00:00Z'))
  state.outage(true)
  await expect(cleanupPreview(pr, state.systems, 'expired')).rejects.toThrow('operator action')
  await expect(cleanupPreview(pr, state.systems, 'expired')).rejects.toThrow('operator action')
  expect(state.post).toHaveBeenCalledTimes(1)
  expect(state.snapshot()).toBe(original)
  expect(state.resources.has(pr.number)).toBe(true)
  await expect(reconcilePreview(pr, state.systems)).rejects.toThrow('explicit operator recreation')
  expect(state.database).not.toHaveBeenCalled()
  state.outage(false)
  await cleanupPreview(pr, state.systems, 'expired')
  expect(state.resources.size).toBe(0)
  expect((await state.systems.record(pr.number))?.phase).toBe('cleaned')
  expect(state.status).toHaveBeenCalledWith(
    pr,
    'failure',
    'Preview expired; explicit operator recreation required',
  )
  await cleanupPreview(pr, state.systems, 'expired')
  expect(state.remove).toHaveBeenCalledTimes(3)
  await expect(reconcilePreview(pr, state.systems)).rejects.toThrow('explicit operator recreation')
  expect(state.issues).toHaveLength(1) // Successful cleanup never silently resolves an alert.
})

it('only cleans a closed PR through the ordinary cleanup path', async () => {
  const state = cloud(createReservation(pr, now))
  await expect(cleanupPreview(pr, state.systems)).rejects.toThrow('Only a closed PR')
  const closed = { ...pr, state: 'closed' as const }
  state.current(closed)
  await cleanupPreview(closed, state.systems)
  await cleanupPreview(closed, state.systems)
  expect(state.remove).toHaveBeenCalledTimes(1)
})

it('refuses obsolete PR state before deleting resources', async () => {
  const state = cloud(createReservation(pr, now))
  state.current({ ...pr, sha: 'b'.repeat(40), state: 'closed' })
  await expect(cleanupPreview({ ...pr, state: 'closed' }, state.systems)).rejects.toThrow(
    'PR changed',
  )
  expect(state.remove).not.toHaveBeenCalled()
})

it('cannot mark a Preview ready if TTL expires during preparation', async () => {
  const state = cloud()
  state.systems.verify = async () => {
    state.clock(new Date('2026-10-30T12:00:00Z'))
  }
  await expect(reconcilePreview(pr, state.systems)).rejects.toThrow('no reset')
  expect((await state.systems.record(pr.number))?.phase).toBe('prepared')
  expect(state.status).not.toHaveBeenCalledWith(pr, 'success', expect.anything())
})
