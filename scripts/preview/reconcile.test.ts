import { expect, it } from 'vitest'
import {
  cleanupPreview,
  reconcilePreview,
  type PreviewSystems,
  type PreviewRecord,
} from './reconcile'
import { createStateCodec } from './state'
import type { PreviewIdentity } from '../../src/server/db/preview-target'
import type { PullRequest } from './policy'

const pr: PullRequest = {
  number: 120,
  repository: 'DMV22/Pro-League',
  headRepository: 'DMV22/Pro-League',
  base: 'develop',
  sha: 'a'.repeat(40),
  state: 'open',
}

it('rejects an obsolete PR head before allocating resources', async () => {
  await expect(
    reconcilePreview(pr, { current: async () => ({ ...pr, sha: 'b'.repeat(40) }) } as never),
  ).rejects.toThrow('PR changed')
})

function externalSystems() {
  const prs = new Map<number, PullRequest>([[pr.number, { ...pr }]])
  const comments = new Map<number, string>()
  const databases = new Map<number, PreviewIdentity>()
  const deployments = new Map<number, string>()
  const statuses = new Map<string, string>()
  const alerts = new Set<number>()
  const codec = createStateCodec('12'.repeat(32))
  let unavailable = false
  const systems: PreviewSystems = {
    current: async (number) => ({ ...prs.get(number)! }),
    files: async () => ['src/app/page.tsx'],
    record: async (number) =>
      comments.has(number) ? codec.decode(comments.get(number)!, number) : undefined,
    save: async (record) => {
      comments.set(record.pr, codec.encode(record))
    },
    database: async (current) => {
      const existing = databases.get(current.number)
      if (existing) return existing
      if (databases.size >= 2) throw new Error('capacity')
      const identity: PreviewIdentity = {
        projectId: 'long-sea-15202409',
        parentBranchId: 'br-divine-leaf-b90tlpj2',
        branchId: `br-pr-${current.number}`,
        endpointId: `ep-preview-${current.number}`,
        directHost: `ep-preview-${current.number}.c-7.eu-central-1.aws.neon.tech`,
        pullRequest: current.number,
        database: `proleague_golden_seed_pr_${current.number}`,
      }
      databases.set(current.number, identity)
      return identity
    },
    prepare: async () => undefined,
    bind: async (current) => {
      if (unavailable) throw new Error('temporary provider failure')
      deployments.set(current.number, current.sha)
      return { serviceId: `srv-preview${current.number}`, deployId: `dep-preview${current.number}` }
    },
    verify: async (current) => {
      if (deployments.get(current.number) !== current.sha) throw new Error('not ready')
    },
    remove: async (current, record) => {
      if (unavailable) throw new Error('provider unavailable')
      if (record.identity && databases.get(current.number)?.branchId !== record.identity.branchId)
        throw new Error('foreign identity')
      databases.delete(current.number)
      deployments.delete(current.number)
    },
    status: async (current, state) => {
      statuses.set(current.sha, state)
    },
    alert: async (current) => {
      alerts.add(current.number)
    },
    now: () => new Date('2026-10-20T12:00:00Z'),
  }
  return {
    systems,
    prs,
    databases,
    deployments,
    statuses,
    alerts,
    outage: (value: boolean) => {
      unavailable = value
    },
  }
}

it('resumes after a binding failure without replacing the already prepared database', async () => {
  const cloud = externalSystems()
  cloud.outage(true)
  await expect(reconcilePreview(pr, cloud.systems)).rejects.toThrow('no reset')
  const first = cloud.databases.get(120)
  expect(cloud.statuses.get(pr.sha)).toBe('failure')
  cloud.outage(false)
  expect((await reconcilePreview(pr, cloud.systems)).kind).toBe('ready')
  expect(cloud.databases.get(120)).toEqual(first)
  expect(cloud.statuses.get(pr.sha)).toBe('success')
})

it('keeps two PRs isolated and blocks a third without deleting either database', async () => {
  const cloud = externalSystems()
  const second = { ...pr, number: 121, sha: 'b'.repeat(40) }
  const third = { ...pr, number: 122, sha: 'c'.repeat(40) }
  cloud.prs.set(121, second)
  cloud.prs.set(122, third)
  const first = await reconcilePreview(pr, cloud.systems)
  const next = await reconcilePreview(second, cloud.systems)
  expect(first.kind).toBe('ready')
  expect(next.kind).toBe('ready')
  expect(cloud.databases.get(120)?.database).toBe('proleague_golden_seed_pr_120')
  expect(cloud.databases.get(121)?.database).toBe('proleague_golden_seed_pr_121')
  await expect(reconcilePreview(third, cloud.systems)).rejects.toThrow('no reset')
  expect([...cloud.databases.keys()]).toEqual([120, 121])
})

it('does not deploy after the PR closes while preparing its database', async () => {
  const cloud = externalSystems()
  cloud.systems.prepare = async () => {
    cloud.prs.set(120, { ...pr, state: 'closed' })
  }
  await expect(reconcilePreview(pr, cloud.systems)).rejects.toThrow()
  expect(cloud.deployments.has(120)).toBe(false)
  expect((await cleanupPreview(cloud.prs.get(120)!, cloud.systems)).kind).toBe('cleaned')
  expect(cloud.databases.size).toBe(0)
})

it('refuses expired state rather than extending TTL or silently recreating', async () => {
  const cloud = externalSystems()
  const record: PreviewRecord = {
    pr: 120,
    sha: pr.sha,
    phase: 'reserved',
    expiresAt: '2026-10-19T00:00:00Z',
  }
  await cloud.systems.save(record)
  await expect(reconcilePreview(pr, cloud.systems)).rejects.toThrow('explicit operator recreation')
  expect(cloud.databases.size).toBe(0)
})

it('cleans only a closed PR, is repeatable, and alerts on incomplete cleanup', async () => {
  const cloud = externalSystems()
  await reconcilePreview(pr, cloud.systems)
  await expect(cleanupPreview(pr, cloud.systems)).rejects.toThrow('Only a closed PR')
  const closed = { ...pr, state: 'closed' as const }
  cloud.prs.set(120, closed)
  cloud.outage(true)
  await expect(cleanupPreview(closed, cloud.systems)).rejects.toThrow('operator action')
  expect(cloud.alerts.has(120)).toBe(true)
  expect(cloud.databases.size).toBe(1)
  cloud.outage(false)
  await cleanupPreview(closed, cloud.systems)
  await cleanupPreview(closed, cloud.systems)
  expect(cloud.databases.size).toBe(0)
})
