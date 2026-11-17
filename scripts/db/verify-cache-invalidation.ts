import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { createTransactionAdapter } from '../../src/server/db/transaction'
import { createPublicProjectionStateQuery } from '../../src/server/queries/public-projection-state'
import { createOutboxDelivery } from '../../src/modules/operations/infrastructure/outbox-delivery'
import { createCacheInvalidationDelivery } from '../../src/modules/operations/infrastructure/cache-invalidation-repository'
import { createOutboxRepository } from '../../src/modules/operations/infrastructure/outbox-repository'
import { dispatchOutboxBatch } from '../../src/modules/operations/application/dispatch-outbox'
import { createCacheInvalidationHandler } from '../../src/modules/operations/application/cache-invalidation-handler'
import {
  cacheInvalidationIntent,
  cacheInvalidationPolicy,
  CACHE_INVALIDATION_TYPE,
} from '../../src/modules/operations/application/cache-invalidation'
import type { OutboxIntent } from '../../src/modules/operations/application/outbox-port'
import { assertIntegrationTarget } from './integration-target'
import { loadProjectEnv } from './load-env'

loadProjectEnv()
const target = process.argv.find((a) => a.startsWith('--target='))?.slice(9)
assert(target === 'local' || target === 'ci', 'Specify integration target')
const confirmation = process.argv.find((a) => a.startsWith('--confirm-db='))?.slice(13)
const url = assertIntegrationTarget(process.env.INTEGRATION_DATABASE_URL, target, confirmation)
const pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 5000 })
const db = drizzle({ client: pool })
const competitionId = randomUUID()
const faultName = `cache_fixture_${randomUUID().replaceAll('-', '')}`
const ids: string[] = []
const policy = {
  [CACHE_INVALIDATION_TYPE]: cacheInvalidationPolicy,
  'fixture.other': { schemaVersion: 1, payloadFields: [] },
}
const transaction = createTransactionAdapter(db, { outboxPolicies: policy })
let worker: pg.PoolClient | undefined
try {
  worker = await pool.connect()
  await worker.query('SET ROLE app_worker')
  const workerDb = drizzle({ client: worker })
  const delivery = createOutboxDelivery(workerDb, { messageTypes: [CACHE_INVALIDATION_TYPE] })
  const cache = createCacheInvalidationDelivery(workerDb)
  const projection = createPublicProjectionStateQuery(db)
  const enqueue = (intent: OutboxIntent) => transaction.run((r) => r.outbox.enqueue(intent))
  const nextIntent = async () => {
    const row = await pool.query<{ revision: string }>(
      "select revision::text from app.public_projection_revisions where projection_key='portal'",
    )
    const id = randomUUID()
    ids.push(id)
    return cacheInvalidationIntent({
      id,
      target: { kind: 'portal' },
      revision: BigInt(row.rows[0].revision),
      correlationKey: 'synthetic-cache',
      causationKey: 'accepted-cache-fixture',
    })
  }
  const advance = () =>
    pool.query('update app.competitions set display_name=$2 where id=$1', [
      competitionId,
      `Synthetic cache ${randomUUID()}`,
    ])
  let effects = 0
  const invalidate = async () => {
    effects++
  }
  const handlers = {
    [CACHE_INVALIDATION_TYPE]: createCacheInvalidationHandler(cache, invalidate),
  }

  // One rolled-back decision must leave neither a clock change nor deliverable cache work.
  const before = await projection.read({ kind: 'home' })
  const rolledId = randomUUID()
  ids.push(rolledId)
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.execute(sql`insert into app.competitions(id, display_name, visibility)
      values (${competitionId}::uuid, 'Synthetic cache rollback', 'public')`)
      const clock = await tx.execute<{ revision: string }>(sql`select revision::text
      from app.public_projection_revisions where projection_key='portal'`)
      await createOutboxRepository(tx, policy).enqueue(
        cacheInvalidationIntent({
          id: rolledId,
          target: { kind: 'portal' },
          revision: BigInt(clock.rows[0].revision),
          correlationKey: 'synthetic-cache',
          causationKey: 'rollback',
        }),
      )
      throw new Error('Synthetic rollback')
    }),
    /Synthetic rollback/,
  )
  assert.deepEqual(await projection.read({ kind: 'home' }), before)
  assert.equal(
    (await delivery.claim({ limit: 1, leaseMs: 30_000, maxAttempts: 5 })).scannedCount,
    0,
  )

  await pool.query(
    "insert into app.competitions(id,display_name,visibility) values($1,'Synthetic cache','public')",
    [competitionId],
  )
  const original = await nextIntent()
  const duplicate = { ...original, id: randomUUID() }
  ids.push(duplicate.id)
  await Promise.all([enqueue(original), enqueue(duplicate)])
  // Either concurrent request may win. Observe the canonical work through the delivery interface.
  const leases = await delivery.claim({ limit: 10, leaseMs: 30_000, maxAttempts: 5 })
  assert.equal(leases.leases.length, 1)
  const canonical = leases.leases[0].intent as OutboxIntent
  const pendingGeneration = await projection.read({ kind: 'home' })
  const canonicalHandler = handlers[CACHE_INVALIDATION_TYPE]
  assert.equal(
    await canonicalHandler.run({
      intent: canonical,
      idempotencyKey: canonical.id,
      signal: new AbortController().signal,
    }),
    'succeeded',
  )
  assert.equal(
    await delivery.settle(leases.leases[0], { status: 'succeeded', code: 'delivered' }),
    true,
  )
  assert.equal(effects, 1)
  assert.equal(await cache.state(canonical), 'confirmed')
  const confirmedGeneration = await projection.read({ kind: 'home' })
  assert(pendingGeneration.kind === 'found' && confirmedGeneration.kind === 'found')
  assert.notEqual(
    confirmedGeneration.state.cacheGeneration,
    pendingGeneration.state.cacheGeneration,
  )
  await enqueue(canonical) // Same-ID replay must not reset state.
  assert.equal(
    (await delivery.claim({ limit: 1, leaseMs: 30_000, maxAttempts: 5 })).scannedCount,
    0,
  )

  await advance()
  const old = await nextIntent()
  await enqueue(old)
  await advance()
  const newer = await nextIntent()
  await enqueue(newer)
  await assert.rejects(
    enqueue({ ...newer, id: old.id }),
    'Same ID cannot be coalesced into a different intent',
  )
  // Make the newer delivery run first without asserting an accidental queue ordering.
  await pool.query(
    "update app.outbox_messages set available_at=clock_timestamp()+interval '1 hour' where id=$1",
    [old.id],
  )
  const beforeNewer = effects
  assert.equal((await dispatchOutboxBatch(delivery, handlers, { maxMessages: 1 })).succeeded, 1)
  assert.equal(await cache.state(old), 'confirmed')
  const newerGeneration = await projection.read({ kind: 'home' })
  await pool.query('update app.outbox_messages set available_at=clock_timestamp() where id=$1', [
    old.id,
  ])
  assert.equal((await dispatchOutboxBatch(delivery, handlers, { maxMessages: 1 })).succeeded, 1)
  assert.equal(
    effects,
    beforeNewer + 1,
    'Older coalesced delivery must not repeat a new domain change/effect',
  )
  assert.deepEqual(await projection.read({ kind: 'home' }), newerGeneration)

  await advance()
  const retry = await nextIntent()
  await enqueue(retry)
  // A real database failure prevents the durable read barrier. Tag cleanup is not that barrier.
  await pool.query(`create function app.${faultName}() returns trigger language plpgsql as $$
    begin raise exception 'Synthetic confirmation retry' using errcode='40001'; end $$`)
  await pool.query(`create trigger ${faultName} before update on app.cache_invalidation_intents
    for each row when (NEW.state='confirmed') execute function app.${faultName}()`)
  assert.equal((await dispatchOutboxBatch(delivery, handlers, { maxMessages: 1 })).retry, 1)
  assert.equal(await cache.state(retry), 'pending')
  assert.equal((await projection.read({ kind: 'home' })).kind, 'found')
  await pool.query(
    "update app.cache_invalidation_intents set created_at=clock_timestamp()-interval '61 seconds' where id=$1",
    [retry.id],
  )
  const delayed = await projection.read({ kind: 'home' })
  assert(delayed.kind === 'found' && delayed.synchronization === 'attention')
  await pool.query(`drop trigger ${faultName} on app.cache_invalidation_intents`)
  await pool.query('update app.outbox_messages set available_at=clock_timestamp() where id=$1', [
    retry.id,
  ])
  assert.equal((await dispatchOutboxBatch(delivery, handlers, { maxMessages: 1 })).succeeded, 1)
  const recovered = await projection.read({ kind: 'home' })
  assert(recovered.kind === 'found' && recovered.synchronization === undefined)

  await advance()
  const exhausted = await nextIntent()
  await enqueue(exhausted)
  await pool.query(`create trigger ${faultName} before update on app.cache_invalidation_intents
    for each row when (NEW.state='confirmed') execute function app.${faultName}()`)
  assert.equal(
    (await dispatchOutboxBatch(delivery, handlers, { maxMessages: 1, maxAttempts: 1 })).exhausted,
    1,
  )
  const warning = await projection.read({ kind: 'home' })
  assert(warning.kind === 'found' && warning.synchronization === 'attention')
  await pool.query(`drop trigger ${faultName} on app.cache_invalidation_intents`)
  // Repair only synthetic evidence for the following isolated scenarios.
  await cache.confirm(exhausted)

  await advance()
  const cleanupFailure = await nextIntent()
  await enqueue(cleanupFailure)
  const beforeCleanup = await projection.read({ kind: 'home' })
  const cleanupHandlers = {
    [CACHE_INVALIDATION_TYPE]: createCacheInvalidationHandler(cache, async () => {
      throw new Error('Synthetic unavailable tag cleanup')
    }),
  }
  assert.equal(
    (await dispatchOutboxBatch(delivery, cleanupHandlers, { maxMessages: 1 })).succeeded,
    1,
  )
  const afterCleanup = await projection.read({ kind: 'home' })
  assert(beforeCleanup.kind === 'found' && afterCleanup.kind === 'found')
  assert.equal(beforeCleanup.state.revision, afterCleanup.state.revision)
  assert.notEqual(beforeCleanup.state.cacheGeneration, afterCleanup.state.cacheGeneration)
  assert.equal(afterCleanup.synchronization, undefined)

  const invalid = await nextIntent()
  await assert.rejects(enqueue({ ...invalid, payload: { ...invalid.payload, urgency: 'urgent' } }))
  await assert.rejects(
    enqueue({
      ...invalid,
      aggregateVersion: invalid.aggregateVersion + 100n,
      payload: { ...invalid.payload, revision: String(invalid.aggregateVersion + 100n) },
    }),
  )

  const other = { ...invalid, id: randomUUID(), messageType: 'fixture.other', payload: {} }
  ids.push(other.id)
  await enqueue(other)
  assert.equal(
    (await delivery.claim({ limit: 1, leaseMs: 30_000, maxAttempts: 5 })).scannedCount,
    0,
  )
  const otherDelivery = createOutboxDelivery(db, { messageTypes: ['fixture.other'] })
  const otherLease = (await otherDelivery.claim({ limit: 1, leaseMs: 30_000, maxAttempts: 5 }))
    .leases[0]
  assert.equal(otherLease.id, other.id, 'Cache dispatch must not drain another message type')
  assert.equal(
    await otherDelivery.settle(otherLease, { status: 'succeeded', code: 'delivered' }),
    true,
  )
  console.info(
    'Cache invalidation transaction, semantic deduplication, coalescing, retry, scope and freshness checks passed',
  )
} finally {
  worker?.release(true)
  try {
    await pool.query(`drop trigger if exists ${faultName} on app.cache_invalidation_intents`)
    await pool.query(`drop function if exists app.${faultName}()`)
    await pool.query('delete from app.outbox_messages where id=any($1::uuid[])', [ids])
    await pool.query('delete from app.cache_invalidation_intents where id=any($1::uuid[])', [ids])
    await pool.query('delete from app.competitions where id=$1', [competitionId])
  } finally {
    await pool.end()
  }
}
