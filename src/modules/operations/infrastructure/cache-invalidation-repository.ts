import { and, eq, lte, ne, sql } from 'drizzle-orm'
import type { Database, DatabaseTransaction } from '../../../server/db/transaction-types'
import { OutboxFailure, type OutboxIntent } from '../application/outbox-port'
import { readCacheInvalidation } from '../application/cache-invalidation'
import { cacheInvalidationIntents } from './schema'

/** Called only by the transactional Outbox adapter. Same target/revision has one durable intent. */
export async function recordCacheInvalidation(tx: DatabaseTransaction, intent: OutboxIntent) {
  const parsed = readCacheInvalidation(intent)
  const existing = async () =>
    (
      await tx
        .select({ id: cacheInvalidationIntents.id })
        .from(cacheInvalidationIntents)
        .where(
          and(
            eq(cacheInvalidationIntents.semanticTarget, parsed.semanticTarget),
            eq(cacheInvalidationIntents.committedVersion, parsed.revision),
          ),
        )
    )[0]?.id
  const previous = await existing()
  if (previous) return previous
  // The clock is trigger-owned. Callers cannot enqueue invented/future revisions.
  const result = await tx.execute<{ id: string }>(sql`
    insert into app.cache_invalidation_intents
      (id, semantic_target, committed_version, urgency)
    select ${intent.id}::uuid, ${parsed.semanticTarget}, p.revision, 'ordinary'
    from app.public_projection_revisions p
    where p.projection_key=${parsed.sourceKey} and p.revision=${String(parsed.revision)}::bigint
    on conflict (semantic_target, committed_version) do nothing returning id`)
  const canonicalId = result.rows[0]?.id ?? (await existing())
  if (!canonicalId) throw new OutboxFailure('invalid')
  return canonicalId
}

/** Worker writes operational evidence only; confirmation never advances a source revision. */
export function createCacheInvalidationDelivery(database: Database) {
  const match = (intent: OutboxIntent) => {
    const parsed = readCacheInvalidation(intent)
    return and(
      eq(cacheInvalidationIntents.id, intent.id),
      eq(cacheInvalidationIntents.semanticTarget, parsed.semanticTarget),
      eq(cacheInvalidationIntents.committedVersion, parsed.revision),
      eq(cacheInvalidationIntents.urgency, 'ordinary'),
    )
  }
  return {
    async state(intent: OutboxIntent) {
      const [row] = await database
        .select({ state: cacheInvalidationIntents.state })
        .from(cacheInvalidationIntents)
        .where(match(intent))
      if (!row) throw new OutboxFailure('invalid')
      return row.state
    },
    async confirm(intent: OutboxIntent) {
      const parsed = readCacheInvalidation(intent)
      await database
        .update(cacheInvalidationIntents)
        .set({
          state: 'confirmed',
          confirmedAt: sql`clock_timestamp()`,
          updatedAt: sql`clock_timestamp()`,
          version: sql`${cacheInvalidationIntents.version} + 1`,
        })
        .where(
          and(
            eq(cacheInvalidationIntents.semanticTarget, parsed.semanticTarget),
            lte(cacheInvalidationIntents.committedVersion, parsed.revision),
            eq(cacheInvalidationIntents.urgency, 'ordinary'),
            ne(cacheInvalidationIntents.state, 'confirmed'),
          ),
        )
    },
    async fail(intent: OutboxIntent) {
      await database
        .update(cacheInvalidationIntents)
        .set({
          state: 'failed',
          updatedAt: sql`clock_timestamp()`,
          version: sql`${cacheInvalidationIntents.version} + 1`,
        })
        .where(and(match(intent), ne(cacheInvalidationIntents.state, 'confirmed')))
    },
  }
}
