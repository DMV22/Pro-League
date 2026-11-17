import type { DatabaseTransaction } from '../../../server/db/transaction-types'
import { eq, sql } from 'drizzle-orm'
import {
  OutboxFailure,
  type OutboxIntent,
  type OutboxPolicies,
  type OutboxPort,
} from '../application/outbox-port'
import { validateOutbox } from '../application/validate-outbox'
import { mapDatabaseFailure } from '../../../server/db/failures'
import { PersistenceFailure } from '../../../shared/application/persistence'
import { outboxMessages } from './schema'
import { recordCacheInvalidation } from './cache-invalidation-repository'
import { CACHE_INVALIDATION_TYPE, readCacheInvalidation } from '../application/cache-invalidation'

export function createOutboxRepository(
  tx: DatabaseTransaction,
  policies: OutboxPolicies,
): OutboxPort {
  return {
    async enqueue(input) {
      const intent = validateOutbox(input, policies)
      try {
        // Every message type participates, so semantic dedup cannot race an ID insertion.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${intent.id}, 0))`)
        if (intent.messageType === CACHE_INVALIDATION_TYPE) {
          // ID identity must be checked before semantic coalescing can return early.
          // Serialize same-ID enqueues, including different semantic targets.
          const [existingId] = await tx
            .select()
            .from(outboxMessages)
            .where(eq(outboxMessages.id, intent.id))
          if (
            existingId &&
            identity({
              ...existingId,
              payload: existingId.payload as OutboxIntent['payload'],
              causationKey: existingId.causationKey ?? '',
              correlationKey: existingId.correlationKey ?? '',
            }) !== identity(intent)
          )
            throw new OutboxFailure('conflict')
          const canonicalId = await recordCacheInvalidation(tx, intent)
          if (canonicalId !== intent.id) {
            const [canonical] = await tx
              .select()
              .from(outboxMessages)
              .where(eq(outboxMessages.id, canonicalId))
            if (!canonical) throw new OutboxFailure('unavailable')
            const parsed = readCacheInvalidation(canonical as OutboxIntent)
            const incoming = readCacheInvalidation(intent)
            if (
              parsed.semanticTarget !== incoming.semanticTarget ||
              parsed.revision !== incoming.revision
            )
              throw new OutboxFailure('conflict')
            return
          }
        }
        const inserted = await tx
          .insert(outboxMessages)
          .values({ ...intent, availableAt: sql`clock_timestamp()` })
          .onConflictDoNothing({ target: outboxMessages.id })
          .returning({ id: outboxMessages.id })
        if (!inserted.length) {
          const [existing] = await tx
            .select()
            .from(outboxMessages)
            .where(eq(outboxMessages.id, intent.id))
          if (!existing) throw new OutboxFailure('unavailable')
          if (
            identity({
              ...existing,
              payload: existing.payload as OutboxIntent['payload'],
              causationKey: existing.causationKey ?? '',
              correlationKey: existing.correlationKey ?? '',
            }) !== identity(intent)
          )
            throw new OutboxFailure('conflict')
        }
      } catch (error) {
        throw outboxFailure(error)
      }
    },
  }
}

function identity(intent: OutboxIntent): string {
  return JSON.stringify([
    intent.messageType,
    intent.schemaVersion,
    intent.aggregateType,
    intent.aggregateId,
    intent.aggregateVersion.toString(),
    intent.causationKey,
    Object.entries(intent.payload).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ])
}

export function outboxFailure(error: unknown): OutboxFailure {
  if (error instanceof OutboxFailure) return error
  const failure = mapDatabaseFailure(error)
  return new OutboxFailure(
    failure instanceof PersistenceFailure &&
      (failure.kind === 'conflict' || failure.kind === 'retryable')
      ? failure.kind
      : 'unavailable',
  )
}
