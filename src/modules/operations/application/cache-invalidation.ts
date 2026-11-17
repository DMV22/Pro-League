import { OutboxFailure, type OutboxIntent } from './outbox-port'

export const CACHE_INVALIDATION_TYPE = 'public.cache.invalidate'
export const cacheInvalidationPolicy = {
  schemaVersion: 1,
  payloadFields: ['target', 'revision', 'urgency'],
} as const

export type PublicCacheTarget =
  | Readonly<{ kind: 'portal' }>
  | Readonly<{ kind: 'competition' | 'season' | 'schedule' | 'standings'; id: string }>

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const portalId = '00000000-0000-0000-0000-000000000000'
const maxRevision = 9223372036854775807n

/** Server-owned intent projection; not an HTTP body or an authority to mutate a projection clock. */
export function cacheInvalidationIntent(input: {
  id: string
  target: PublicCacheTarget
  revision: bigint
  correlationKey: string
  causationKey: string
}): OutboxIntent {
  const target =
    input.target.kind === 'portal' ? 'portal' : `${input.target.kind}:${input.target.id}`
  const intent: OutboxIntent = {
    id: input.id,
    messageType: CACHE_INVALIDATION_TYPE,
    schemaVersion: 1,
    payload: { target, revision: String(input.revision), urgency: 'ordinary' },
    aggregateType: 'public-projection',
    aggregateId: input.target.kind === 'portal' ? portalId : input.target.id,
    aggregateVersion: input.revision,
    correlationKey: input.correlationKey,
    causationKey: input.causationKey,
  }
  readCacheInvalidation(intent)
  return intent
}

/** Shared interpretation at enqueue and delivery. Urgent Purge is deliberately unsupported. */
export function readCacheInvalidation(intent: OutboxIntent) {
  const { target, revision, urgency } = intent.payload
  if (
    intent.messageType !== CACHE_INVALIDATION_TYPE ||
    intent.schemaVersion !== 1 ||
    intent.aggregateType !== 'public-projection' ||
    Object.keys(intent.payload).sort().join(',') !== 'revision,target,urgency' ||
    typeof revision !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(revision) ||
    BigInt(revision) > maxRevision ||
    BigInt(revision) !== intent.aggregateVersion ||
    urgency !== 'ordinary' ||
    typeof target !== 'string'
  )
    throw new OutboxFailure('invalid')
  const parts = target.split(':')
  let parsed: PublicCacheTarget
  if (target === 'portal' && intent.aggregateId === portalId) parsed = { kind: 'portal' }
  else {
    const [kind, id] = parts
    if (
      parts.length !== 2 ||
      !['competition', 'season', 'schedule', 'standings'].includes(kind) ||
      !uuid.test(id) ||
      id !== id.toLowerCase() ||
      id !== intent.aggregateId.toLowerCase()
    )
      throw new OutboxFailure('invalid')
    parsed = { kind: kind as Exclude<PublicCacheTarget['kind'], 'portal'>, id }
  }
  const sourceKey =
    parsed.kind === 'portal'
      ? 'portal'
      : `${parsed.kind === 'competition' ? 'competition' : 'season'}:${parsed.id}`
  return { target: parsed, semanticTarget: target, sourceKey, revision: BigInt(revision) }
}
