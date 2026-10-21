import type { PreviewIdentity } from '../../src/server/db/preview-target'
import { planPreview, type PullRequest } from './policy'

export type PreviewRecord = {
  pr: number
  expiresAt: string
  sha: string
  phase: 'reserved' | 'prepared' | 'ready' | 'cleaned'
  identity?: PreviewIdentity
  serviceId?: string
  deployId?: string
  migrationHash?: string
}

/** External systems only. Provider details and secrets never enter workflow outputs. */
export type PreviewSystems = {
  current(number: number): Promise<PullRequest>
  files(pr: PullRequest): Promise<string[]>
  record(number: number): Promise<PreviewRecord | undefined>
  save(record: PreviewRecord): Promise<void>
  database(pr: PullRequest, record: PreviewRecord): Promise<PreviewIdentity>
  prepare(pr: PullRequest, record: PreviewRecord): Promise<void>
  bind(pr: PullRequest, record: PreviewRecord): Promise<{ serviceId: string; deployId: string }>
  verify(pr: PullRequest, record: PreviewRecord): Promise<void>
  remove(pr: PullRequest, record: PreviewRecord): Promise<void>
  status(pr: PullRequest, state: 'pending' | 'success' | 'failure', message: string): Promise<void>
  alert(pr: PullRequest): Promise<void>
  now(): Date
}

export async function assertCurrent(pr: PullRequest, systems: Pick<PreviewSystems, 'current'>) {
  const current = await systems.current(pr.number)
  if (
    current.state !== pr.state ||
    current.sha !== pr.sha ||
    current.base !== pr.base ||
    current.repository !== pr.repository ||
    current.headRepository !== pr.headRepository
  )
    throw new Error('PR changed; reconcile its current revision')
}

export async function reconcilePreview(pr: PullRequest, systems: PreviewSystems) {
  await assertCurrent(pr, systems)
  const plan = planPreview(pr, await systems.files(pr))
  if (plan.kind === 'skip') return plan
  if (plan.kind === 'cleanup') return cleanupPreview(pr, systems)
  const previous = await systems.record(pr.number)
  if (
    previous &&
    (previous.phase === 'cleaned' || Date.parse(previous.expiresAt) <= systems.now().getTime())
  )
    throw new Error('Preview expired or removed; explicit operator recreation is required')
  const record: PreviewRecord = previous ?? {
    pr: pr.number,
    sha: pr.sha,
    phase: 'reserved',
    expiresAt: new Date(
      Math.floor(systems.now().getTime() / 1000) * 1000 + 7 * 86400_000,
    ).toISOString(),
  }
  // Preserve reservation/expiry across retries; no new lifetime on every push.
  record.sha = pr.sha
  await systems.status(pr, 'pending', 'Preparing isolated Preview')
  await systems.save(record)
  try {
    await assertCurrent(pr, systems)
    record.identity = await systems.database(pr, record)
    await systems.save(record)
    await assertCurrent(pr, systems)
    await systems.prepare(pr, record)
    record.phase = 'prepared'
    await systems.save(record)
    await assertCurrent(pr, systems)
    Object.assign(record, await systems.bind(pr, record))
    await systems.save(record)
    await systems.verify(pr, record)
    await assertCurrent(pr, systems)
    record.phase = 'ready'
    await systems.save(record)
    await systems.status(pr, 'success', 'Isolated Preview verified for this SHA')
    return { kind: 'ready', record } as const
  } catch {
    // Never echo provider errors, SQL, PR titles, tokens or connection strings.
    await systems.status(pr, 'failure', 'Preview preparation failed; inspect sanitized run summary')
    throw new Error(
      'Preview preparation failed; resources retained for diagnosis, no reset performed',
    )
  }
}

export async function cleanupPreview(pr: PullRequest, systems: PreviewSystems) {
  await assertCurrent(pr, systems)
  if (pr.state !== 'closed') throw new Error('Only a closed PR may be cleaned automatically')
  const record = await systems.record(pr.number)
  if (!record || record.phase === 'cleaned') return { kind: 'cleaned' } as const
  try {
    await systems.remove(pr, record)
    await assertCurrent(pr, systems)
    await systems.save({ ...record, phase: 'cleaned' })
    return { kind: 'cleaned' } as const
  } catch {
    await systems.alert(pr)
    throw new Error('Preview cleanup incomplete; operator action required')
  }
}
