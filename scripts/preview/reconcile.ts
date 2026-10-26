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

/** One fixed lifetime for both initial allocation and explicit recreation. */
export function createReservation(pr: PullRequest, now: Date): PreviewRecord {
  return {
    pr: pr.number,
    sha: pr.sha,
    phase: 'reserved',
    expiresAt: new Date(Math.floor(now.getTime() / 1000) * 1000 + 7 * 86400_000).toISOString(),
  }
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
  const record = previous ?? createReservation(pr, systems.now())
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
    if (Date.parse(record.expiresAt) <= systems.now().getTime())
      throw new Error(
        'Preview expired during preparation; explicit cleanup and recreation required',
      )
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

export async function cleanupPreview(
  pr: PullRequest,
  systems: PreviewSystems,
  reason: 'closed' | 'expired' = 'closed',
) {
  await assertCurrent(pr, systems)
  if (reason === 'closed' && pr.state !== 'closed')
    throw new Error('Only a closed PR may be cleaned automatically')
  const record = await systems.record(pr.number)
  if (!record || record.phase === 'cleaned') return { kind: 'cleaned' } as const
  if (reason === 'expired' && !(Date.parse(record.expiresAt) <= systems.now().getTime()))
    throw new Error('Only an expired reservation may be cleaned')
  try {
    await systems.remove(pr, record)
    await assertCurrent(pr, systems)
    await systems.save({ ...record, phase: 'cleaned' })
    if (reason === 'expired')
      await systems.status(pr, 'failure', 'Preview expired; explicit operator recreation required')
    return { kind: 'cleaned' } as const
  } catch {
    await systems.alert(pr)
    throw new Error('Preview cleanup incomplete; operator action required')
  }
}
