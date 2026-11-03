import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { createTransactionAdapter } from '../../src/server/db/transaction'
import { OutboxFailure } from '../../src/modules/operations/application/outbox-port'
import { createOutboxDelivery } from '../../src/modules/operations/infrastructure/outbox-delivery'
import { dispatchOutboxBatch } from '../../src/modules/operations/application/dispatch-outbox'
import type { DeliveryResult } from '../../src/modules/operations/application/outbox-delivery-port'
import { assertIntegrationTarget } from './integration-target'
import { loadProjectEnv } from './load-env'

loadProjectEnv()
const target = process.argv.find((arg) => arg.startsWith('--target='))?.slice(9)
assert(target === 'local' || target === 'ci', 'Specify an integration target')
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm-db='))?.slice(13)
const url = assertIntegrationTarget(process.env.INTEGRATION_DATABASE_URL, target, confirmation)
const pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 5_000 })
const database = drizzle({ client: pool })
const policies = { 'test.effect': { schemaVersion: 1, payloadFields: ['recordId'] } }
const transaction = createTransactionAdapter(database, { outboxPolicies: policies })
const fixtureIds: string[] = []
const intent = () => {
  const id = randomUUID()
  fixtureIds.push(id)
  return {
    id,
    messageType: 'test.effect',
    schemaVersion: 1,
    payload: { recordId: randomUUID() },
    aggregateType: 'competition',
    aggregateId: randomUUID(),
    aggregateVersion: 1n,
    correlationKey: 'synthetic-outbox',
    causationKey: 'synthetic-command',
  }
}

try {
  const maintenanceDelivery = createOutboxDelivery(database)
  const invalidPolicy = (error: unknown) =>
    error instanceof OutboxFailure && error.kind === 'invalid'
  for (const options of [
    { maxMessages: 0 },
    { maxMessages: 101 },
    { maxDurationMs: 300_001 },
    { leaseMs: 600_001 },
    { maxAttempts: 21 },
    { handlerTimeoutMs: 20_001 },
    { baseBackoffMs: 60_001 },
    { maxMessages: 1.5 },
    { maxDurationMs: Number.NaN },
    { leaseMs: 9_999 },
  ])
    await assert.rejects(dispatchOutboxBatch(maintenanceDelivery, {}, options), invalidPolicy)
  for (const options of [
    { limit: 0, leaseMs: 30_000, maxAttempts: 5 },
    { limit: 101, leaseMs: 30_000, maxAttempts: 5 },
    { limit: 1, leaseMs: 600_001, maxAttempts: 5 },
    { limit: 1, leaseMs: 30_000, maxAttempts: 21 },
  ])
    await assert.rejects(maintenanceDelivery.claim(options), invalidPolicy)
  for (const limit of [0, 101, Number.NaN])
    await assert.rejects(maintenanceDelivery.listProblems(limit), invalidPolicy)
  assert.deepEqual(
    await maintenanceDelivery.claim({ limit: 100, leaseMs: 600_000, maxAttempts: 20 }),
    { leases: [], scannedCount: 0, exhaustedCount: 0 },
  )
  const emptySummary = {
    scanned: 0,
    processed: 0,
    succeeded: 0,
    retry: 0,
    failed: 0,
    exhausted: 0,
    lostLease: 0,
  }
  assert.deepEqual(
    await dispatchOutboxBatch(
      maintenanceDelivery,
      {},
      {
        maxMessages: 100,
        maxDurationMs: 300_000,
        leaseMs: 600_000,
        maxAttempts: 20,
        handlerTimeoutMs: 20_000,
        baseBackoffMs: 60_000,
      },
    ),
    emptySummary,
  )
  assert.deepEqual(
    await dispatchOutboxBatch(maintenanceDelivery, {}, { leaseMs: 10_000 }),
    emptySummary,
  )
  const defaultsBatch = Array.from({ length: 21 }, intent)
  await transaction.run(async ({ outbox }) => {
    for (const item of defaultsBatch) await outbox.enqueue(item)
  })
  const defaultSummary = await dispatchOutboxBatch(maintenanceDelivery, {
    'test.effect': {
      ...policies['test.effect'],
      async run() {
        return 'succeeded' as const
      },
    },
  })
  assert.deepEqual(
    defaultSummary,
    { scanned: 20, processed: 20, succeeded: 20, retry: 0, failed: 0, exhausted: 0, lostLease: 0 },
    'Default batch policy changed',
  )
  const remainingDefaults = await maintenanceDelivery.claim({
    limit: 100,
    leaseMs: 30_000,
    maxAttempts: 5,
  })
  assert.equal(remainingDefaults.leases.length, 1)
  await maintenanceDelivery.settle(remainingDefaults.leases[0], {
    status: 'succeeded',
    code: 'delivered',
  })
  const policyFixture = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(policyFixture))
  const policyLease = (
    await maintenanceDelivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 3 })
  ).leases.find((lease) => lease.id === policyFixture.id)!
  assert(policyLease)
  for (const invalidResult of [
    { status: 'succeeded', code: 'handler_timeout' },
    { status: 'failed', code: 'delivered' },
    { status: 'exhausted', code: 'attempt_limit' },
    { status: 'retry', code: 'handler_failure', delayMs: 1 },
    { status: 'retry', code: 'transient_failure', delayMs: 0 },
    { status: 'retry', code: 'transient_failure', delayMs: 86_400_001 },
  ]) {
    await assert.rejects(
      maintenanceDelivery.settle(policyLease, invalidResult as DeliveryResult),
      (error: unknown) => error instanceof OutboxFailure && error.kind === 'invalid',
    )
  }
  assert.deepEqual(
    (
      await pool.query('SELECT state, version FROM app.outbox_messages WHERE id = $1', [
        policyFixture.id,
      ])
    ).rows[0],
    { state: 'leased', version: policyLease.version.toString() },
  )
  await maintenanceDelivery.settle(policyLease, { status: 'succeeded', code: 'delivered' })
  const legalResults: DeliveryResult[] = [
    { status: 'failed', code: 'handler_failure' },
    { status: 'failed', code: 'unknown_message_type' },
    { status: 'failed', code: 'invalid_message' },
    { status: 'exhausted', code: 'transient_failure' },
    { status: 'exhausted', code: 'handler_timeout' },
    { status: 'retry', code: 'transient_failure', delayMs: 86_400_000 },
    { status: 'retry', code: 'handler_timeout', delayMs: 86_400_000 },
  ]
  for (const result of legalResults) {
    const item = intent()
    await transaction.run(({ outbox }) => outbox.enqueue(item))
    const lease = (
      await maintenanceDelivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 3 })
    ).leases.find((entry) => entry.id === item.id)!
    assert(lease)
    assert.equal(await maintenanceDelivery.settle(lease, result), true)
    assert.equal(
      (
        await pool.query('SELECT sanitized_outcome FROM app.outbox_messages WHERE id = $1', [
          item.id,
        ])
      ).rows[0].sanitized_outcome,
      result.code,
    )
    if (result.status !== 'retry')
      assert(
        (await maintenanceDelivery.listProblems(100)).some(
          (entry) => entry.id === item.id && entry.code === result.code,
        ),
      )
  }
  const diagnostic = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(diagnostic))
  await pool.query(
    "UPDATE app.outbox_messages SET state = 'failed', sanitized_outcome = 'synthetic-private-outcome' WHERE id = $1",
    [diagnostic.id],
  )
  assert.equal(
    (await maintenanceDelivery.listProblems(100)).find((entry) => entry.id === diagnostic.id)?.code,
    'unclassified',
  )
  await pool.query(
    "UPDATE app.outbox_messages SET state = 'leased', lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1",
    [diagnostic.id],
  )
  assert.equal(
    (await maintenanceDelivery.listProblems(100)).find((entry) => entry.id === diagnostic.id)?.code,
    'lease_expired',
  )
  await pool.query(
    "UPDATE app.outbox_messages SET state = 'failed', lease_until_at = null WHERE id = $1",
    [diagnostic.id],
  )
  for (const [priorAttempts, baseBackoffMs, expectedDelayMs] of [
    [2, 1_000, 4_000],
    [3, 40_000, 60_000],
  ]) {
    const backoff = intent()
    await transaction.run(({ outbox }) => outbox.enqueue(backoff))
    await pool.query('UPDATE app.outbox_messages SET attempt_count = $2 WHERE id = $1', [
      backoff.id,
      priorAttempts,
    ])
    const summary = await dispatchOutboxBatch(
      maintenanceDelivery,
      {
        'test.effect': {
          ...policies['test.effect'],
          async run() {
            return 'retry' as const
          },
        },
      },
      { maxMessages: 1, maxAttempts: 5, baseBackoffMs },
    )
    assert.equal(summary.retry, 1)
    const delay = Number(
      (
        await pool.query(
          'SELECT extract(epoch FROM (available_at - updated_at)) * 1000 AS delay_ms FROM app.outbox_messages WHERE id = $1',
          [backoff.id],
        )
      ).rows[0].delay_ms,
    )
    assert(
      Math.abs(delay - expectedDelayMs) < 1_000,
      'Exponential backoff or its existing cap changed',
    )
    await pool.query(
      "UPDATE app.outbox_messages SET available_at = clock_timestamp() + interval '1 day' WHERE id = $1",
      [backoff.id],
    )
  }
  const malformed = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(malformed))
  await pool.query('UPDATE app.outbox_messages SET payload = $2::jsonb WHERE id = $1', [
    malformed.id,
    JSON.stringify({ rawPayload: 'synthetic-private' }),
  ])
  assert.equal(
    (
      await dispatchOutboxBatch(
        maintenanceDelivery,
        {
          'test.effect': {
            ...policies['test.effect'],
            async run() {
              throw new Error('Malformed message reached a handler')
            },
          },
        },
        { maxMessages: 1 },
      )
    ).failed,
    1,
  )
  assert.equal(
    (await maintenanceDelivery.listProblems(100)).find((entry) => entry.id === malformed.id)?.code,
    'invalid_message',
  )
  const badAdapter = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(badAdapter))
  await dispatchOutboxBatch(
    maintenanceDelivery,
    {
      // Deliberately violate the handler type: an adapter response is not a dispatcher observation.
      'test.effect': {
        ...policies['test.effect'],
        async run() {
          return 'unknown_message_type' as 'failed'
        },
      },
    },
    { maxMessages: 1 },
  )
  assert.equal(
    (await maintenanceDelivery.listProblems(100)).find((entry) => entry.id === badAdapter.id)?.code,
    'handler_failure',
  )
  const expiredHead = intent()
  const healthyTail = intent()
  await transaction.run(async ({ outbox }) => {
    await outbox.enqueue(expiredHead)
    await outbox.enqueue(healthyTail)
  })
  // Synthetic queue preparation: the exhausted candidate sorts before healthy due work.
  await pool.query(
    `UPDATE app.outbox_messages SET state = 'leased', attempt_count = 3,
    available_at = clock_timestamp() - interval '2 minutes',
    lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1`,
    [expiredHead.id],
  )
  await pool.query(
    "UPDATE app.outbox_messages SET available_at = clock_timestamp() - interval '1 minute' WHERE id = $1",
    [healthyTail.id],
  )
  const maintenanceSummary = await dispatchOutboxBatch(
    maintenanceDelivery,
    {
      'test.effect': {
        ...policies['test.effect'],
        async run() {
          return 'succeeded' as const
        },
      },
    },
    { maxMessages: 2, maxAttempts: 3 },
  )
  assert.equal(
    maintenanceSummary.succeeded,
    1,
    'Maintenance terminated dispatch before healthy due work',
  )
  assert.deepEqual(maintenanceSummary, {
    scanned: 2,
    processed: 1,
    succeeded: 1,
    retry: 0,
    failed: 0,
    exhausted: 1,
    lostLease: 0,
  })
  const boundedHead = intent()
  const boundedTail = intent()
  await transaction.run(async ({ outbox }) => {
    await outbox.enqueue(boundedHead)
    await outbox.enqueue(boundedTail)
  })
  await pool.query(
    `UPDATE app.outbox_messages SET state = 'leased', attempt_count = 3,
    available_at = clock_timestamp() - interval '2 minutes',
    lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1`,
    [boundedHead.id],
  )
  await pool.query(
    "UPDATE app.outbox_messages SET available_at = clock_timestamp() - interval '1 minute' WHERE id = $1",
    [boundedTail.id],
  )
  const maintenanceOnly = await dispatchOutboxBatch(
    maintenanceDelivery,
    {},
    { maxMessages: 1, maxAttempts: 3 },
  )
  assert.deepEqual(maintenanceOnly, {
    scanned: 1,
    processed: 0,
    succeeded: 0,
    retry: 0,
    failed: 0,
    exhausted: 1,
    lostLease: 0,
  })
  assert.equal(
    (await pool.query('SELECT state FROM app.outbox_messages WHERE id = $1', [boundedTail.id]))
      .rows[0].state,
    'pending',
    'Maintenance bypassed maxMessages budget',
  )
  const nextRun = await dispatchOutboxBatch(
    maintenanceDelivery,
    {
      'test.effect': {
        ...policies['test.effect'],
        async run() {
          return 'succeeded' as const
        },
      },
    },
    { maxMessages: 1, maxAttempts: 3 },
  )
  assert.deepEqual(nextRun, {
    scanned: 1,
    processed: 1,
    succeeded: 1,
    retry: 0,
    failed: 0,
    exhausted: 0,
    lostLease: 0,
  })
  const expiredOnly = [intent(), intent()]
  await transaction.run(async ({ outbox }) => {
    for (const item of expiredOnly) await outbox.enqueue(item)
  })
  await pool.query(
    `UPDATE app.outbox_messages SET state = 'leased', attempt_count = 3,
    lease_until_at = clock_timestamp() - interval '1 second' WHERE id = ANY($1::uuid[])`,
    [expiredOnly.map((item) => item.id)],
  )
  assert.deepEqual(await maintenanceDelivery.claim({ limit: 2, leaseMs: 30_000, maxAttempts: 3 }), {
    leases: [],
    scannedCount: 2,
    exhaustedCount: 2,
  })
  assert.deepEqual(await maintenanceDelivery.claim({ limit: 2, leaseMs: 30_000, maxAttempts: 3 }), {
    leases: [],
    scannedCount: 0,
    exhaustedCount: 0,
  })
  const maintenanceQueue = [intent(), intent(), intent()]
  await transaction.run(async ({ outbox }) => {
    for (const item of maintenanceQueue) await outbox.enqueue(item)
  })
  await pool.query(
    `UPDATE app.outbox_messages SET state = 'leased', attempt_count = 3,
    lease_until_at = clock_timestamp() - interval '1 second' WHERE id = ANY($1::uuid[])`,
    [maintenanceQueue.map((item) => item.id)],
  )
  assert.deepEqual(
    await dispatchOutboxBatch(maintenanceDelivery, {}, { maxMessages: 2, maxAttempts: 3 }),
    { scanned: 2, processed: 0, succeeded: 0, retry: 0, failed: 0, exhausted: 2, lostLease: 0 },
    'Maintenance-only queue exceeded the candidate budget',
  )
  assert.deepEqual(
    await maintenanceDelivery.claim({ limit: 2, leaseMs: 30_000, maxAttempts: 3 }),
    { leases: [], scannedCount: 1, exhaustedCount: 1 },
    'Dispatcher inspected more than its maintenance budget',
  )
  const racedMaintenance = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(racedMaintenance))
  await pool.query(
    `UPDATE app.outbox_messages SET state = 'leased', attempt_count = 3,
    lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1`,
    [racedMaintenance.id],
  )
  const maintenanceRace = await Promise.all([
    maintenanceDelivery.claim({ limit: 1, leaseMs: 30_000, maxAttempts: 3 }),
    maintenanceDelivery.claim({ limit: 1, leaseMs: 30_000, maxAttempts: 3 }),
  ])
  assert.deepEqual(
    maintenanceRace
      .map(({ scannedCount, exhaustedCount, leases }) => [
        scannedCount,
        exhaustedCount,
        leases.length,
      ])
      .sort(),
    [
      [0, 0, 0],
      [1, 1, 0],
    ],
    'Two workers counted the same maintenance twice',
  )
  const message = intent()
  await transaction.run(async ({ competition, outbox }) => {
    await competition.createCompetition({
      id: message.aggregateId,
      displayName: 'Synthetic Outbox fixture',
    })
    await outbox.enqueue(message)
  })
  assert.equal(
    (await pool.query('SELECT id FROM app.outbox_messages WHERE id = $1', [message.id])).rowCount,
    1,
  )
  await transaction.run(({ outbox }) =>
    outbox.enqueue({ ...message, correlationKey: 'another-attempt' }),
  )
  await assert.rejects(
    transaction.run(({ outbox }) => outbox.enqueue({ ...message, aggregateVersion: 2n })),
    (error: unknown) => error instanceof OutboxFailure && error.kind === 'conflict',
  )
  assert.equal(
    (
      await pool.query('SELECT count(*)::int AS count FROM app.outbox_messages WHERE id = $1', [
        message.id,
      ])
    ).rows[0].count,
    1,
  )
  const rejected = intent()
  const reason = new Error('Synthetic domain failure')
  await assert.rejects(
    transaction.run(async ({ competition, outbox }) => {
      await competition.createCompetition({
        id: rejected.aggregateId,
        displayName: 'Must roll back',
      })
      await outbox.enqueue(rejected)
      throw reason
    }),
    (error) => error === reason,
  )
  for (const [table, id] of [
    ['competitions', rejected.aggregateId],
    ['outbox_messages', rejected.id],
  ]) {
    assert.equal((await pool.query(`SELECT id FROM app.${table} WHERE id = $1`, [id])).rowCount, 0)
  }
  const invalid = intent()
  await assert.rejects(
    transaction.run(async ({ competition, outbox }) => {
      await competition.createCompetition({
        id: invalid.aggregateId,
        displayName: 'Invalid intent rollback',
      })
      await outbox
        .enqueue({ ...invalid, payload: { token: 'synthetic-secret' } })
        .catch(() => undefined)
    }),
    (error: unknown) => error instanceof OutboxFailure && error.kind === 'invalid',
  )
  assert.equal(
    (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [invalid.aggregateId]))
      .rowCount,
    0,
  )
  const delivery = createOutboxDelivery(database)
  const contended = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(contended))
  const shortLeases = (await delivery.claim({ limit: 100, leaseMs: 500, maxAttempts: 3 })).leases
  const shortLease = shortLeases.find((lease) => lease.id === contended.id)!
  assert(shortLease)
  const blocker = await pool.connect()
  const waiter = await pool.connect()
  let waiting: Promise<boolean> | undefined
  try {
    await blocker.query('BEGIN')
    await blocker.query('SELECT id FROM app.outbox_messages WHERE id = $1 FOR UPDATE', [
      contended.id,
    ])
    const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    waiting = createOutboxDelivery(drizzle({ client: waiter })).settle(shortLease, {
      status: 'succeeded',
      code: 'delivered',
    })
    let blocked = false
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (
        (await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]))
          .rows[0]?.wait_event_type === 'Lock'
      ) {
        blocked = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert(blocked, 'Acknowledgement did not contend on the test row lock')
    await new Promise((resolve) => setTimeout(resolve, 550))
    await blocker.query('COMMIT')
    assert.equal(
      await waiting,
      false,
      'Acknowledgement accepted a lease that expired while waiting for its lock',
    )
  } finally {
    await blocker.query('ROLLBACK')
    if (waiting) await Promise.allSettled([waiting])
    blocker.release()
    waiter.release()
  }
  // Make the earlier happy-path message immediately eligible after the short-lease contention fixture.
  await pool.query(
    "UPDATE app.outbox_messages SET lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1",
    [message.id],
  )
  const leases = await Promise.all([
    delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 3 }),
    delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 3 }),
  ])
  const ids = leases.flatMap((claim) => claim.leases).map((lease) => lease.id)
  assert.equal(new Set(ids).size, ids.length, 'Workers concurrently own the same message')
  const first = leases.flatMap((claim) => claim.leases).find((lease) => lease.id === message.id)
  assert(first, 'Committed intent was not claimable')
  await pool.query(
    "UPDATE app.outbox_messages SET lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1",
    [message.id],
  )
  assert.equal(
    await delivery.settle(first, { status: 'succeeded', code: 'delivered' }),
    false,
    'Expired lease completed before recovery',
  )
  const recovered = (
    await delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 3 })
  ).leases.find((lease) => lease.id === message.id)
  assert(recovered)
  assert(recovered.version > first.version)
  assert.equal(await delivery.settle(first, { status: 'succeeded', code: 'delivered' }), false)
  assert.equal(await delivery.settle(recovered, { status: 'succeeded', code: 'delivered' }), true)
  const retryMessage = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(retryMessage))
  const retryLease = (
    await delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 2 })
  ).leases.find((lease) => lease.id === retryMessage.id)!
  assert(retryLease)
  assert.equal(
    await delivery.settle(retryLease, {
      status: 'retry',
      code: 'transient_failure',
      delayMs: 10_000,
    }),
    true,
  )
  assert(
    !(await delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 2 })).leases.some(
      (lease) => lease.id === retryMessage.id,
    ),
    'Backoff was ignored',
  )
  await pool.query(
    "UPDATE app.outbox_messages SET available_at = clock_timestamp() - interval '1 second' WHERE id = $1",
    [retryMessage.id],
  )
  const lastLease = (
    await delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 2 })
  ).leases.find((lease) => lease.id === retryMessage.id)!
  assert.equal(lastLease.attemptCount, 2)
  await pool.query(
    "UPDATE app.outbox_messages SET lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1",
    [retryMessage.id],
  )
  assert(
    !(await delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 2 })).leases.some(
      (lease) => lease.id === retryMessage.id,
    ),
    'Crash recovery exceeded attempt budget',
  )
  assert.equal(
    (
      await pool.query('SELECT state, sanitized_outcome FROM app.outbox_messages WHERE id = $1', [
        retryMessage.id,
      ])
    ).rows[0].state,
    'exhausted',
  )
  const crashMessage = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(crashMessage))
  const crashLease = (
    await delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 3 })
  ).leases.find((lease) => lease.id === crashMessage.id)!
  assert(crashLease)
  const sink = await pool.connect()
  try {
    // Synthetic downstream system, on a separate connection, with durable effect-key uniqueness.
    await sink.query('CREATE TEMP TABLE synthetic_outbox_effects (effect_key text PRIMARY KEY)')
    const effect = async (key: string) => {
      await sink.query('INSERT INTO synthetic_outbox_effects VALUES ($1) ON CONFLICT DO NOTHING', [
        key,
      ])
    }
    await effect(crashMessage.id) // Crash after external success, before acknowledgement.
    await pool.query(
      "UPDATE app.outbox_messages SET lease_until_at = clock_timestamp() - interval '1 second' WHERE id = $1",
      [crashMessage.id],
    )
    await dispatchOutboxBatch(
      delivery,
      {
        'test.effect': {
          ...policies['test.effect'],
          async run({ idempotencyKey }) {
            await sink.query('SELECT id FROM app.outbox_messages WHERE id = $1 FOR UPDATE NOWAIT', [
              idempotencyKey,
            ])
            await effect(idempotencyKey)
            return 'succeeded' as const
          },
        },
      },
      { maxMessages: 20, maxDurationMs: 10_000 },
    )
    assert.equal(
      (
        await sink.query(
          'SELECT count(*)::int AS count FROM synthetic_outbox_effects WHERE effect_key = $1',
          [crashMessage.id],
        )
      ).rows[0].count,
      1,
    )
    assert.equal(
      (await pool.query('SELECT state FROM app.outbox_messages WHERE id = $1', [crashMessage.id]))
        .rows[0].state,
      'succeeded',
    )
  } finally {
    sink.release()
  }
  const transient = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(transient))
  const retrySummary = await dispatchOutboxBatch(
    delivery,
    {
      'test.effect': {
        ...policies['test.effect'],
        async run() {
          return 'retry' as const
        },
      },
    },
    { maxMessages: 1, baseBackoffMs: 10_000 },
  )
  assert.equal(retrySummary.retry, 1)
  assert.equal(
    (await pool.query('SELECT state FROM app.outbox_messages WHERE id = $1', [transient.id]))
      .rows[0].state,
    'pending',
  )
  await pool.query(
    "UPDATE app.outbox_messages SET available_at = clock_timestamp() + interval '1 day' WHERE id = $1",
    [transient.id],
  )
  const slow = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(slow))
  const timeoutSummary = await dispatchOutboxBatch(
    delivery,
    {
      'test.effect': {
        ...policies['test.effect'],
        async run() {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return 'succeeded' as const
        },
      },
    },
    { maxMessages: 1, handlerTimeoutMs: 20, maxDurationMs: 1_000 },
  )
  assert.equal(timeoutSummary.retry, 1)
  assert.equal(
    (await pool.query('SELECT sanitized_outcome FROM app.outbox_messages WHERE id = $1', [slow.id]))
      .rows[0].sanitized_outcome,
    'handler_timeout',
  )
  await pool.query(
    "UPDATE app.outbox_messages SET available_at = clock_timestamp() + interval '1 day' WHERE id = $1",
    [slow.id],
  )
  const unknown = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(unknown))
  const unknownSummary = await dispatchOutboxBatch(delivery, {}, { maxMessages: 1 })
  assert.equal(unknownSummary.failed, 1)
  const failure = intent()
  await transaction.run(({ outbox }) => outbox.enqueue(failure))
  const failedSummary = await dispatchOutboxBatch(
    delivery,
    {
      'test.effect': {
        ...policies['test.effect'],
        async run() {
          throw new Error('synthetic-private-error')
        },
      },
    },
    { maxMessages: 1 },
  )
  assert.equal(failedSummary.failed, 1)
  const problems = await delivery.listProblems(100)
  assert(problems.some((row) => row.id === unknown.id && row.code === 'unknown_message_type'))
  assert(problems.some((row) => row.id === failure.id && row.code === 'handler_failure'))
  assert(
    !JSON.stringify(problems, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ).includes('synthetic-private-error'),
  )
  const budgeted = [intent(), intent()]
  for (const item of budgeted) await transaction.run(({ outbox }) => outbox.enqueue(item))
  const capped = await dispatchOutboxBatch(
    delivery,
    {
      'test.effect': {
        ...policies['test.effect'],
        async run() {
          return 'retry' as const
        },
      },
    },
    { maxMessages: 1, maxAttempts: 1 },
  )
  assert.equal(capped.processed, 1, 'Dispatcher exceeded batch limit')
  assert.equal(capped.exhausted, 1, 'Final transient attempt was not exhausted')
  assert.equal(
    (await delivery.claim({ limit: 100, leaseMs: 30_000, maxAttempts: 3 })).leases.filter((lease) =>
      budgeted.some((item) => item.id === lease.id),
    ).length,
    1,
  )
  const duplicate = intent()
  await Promise.all([
    transaction.run(({ outbox }) => outbox.enqueue(duplicate)),
    transaction.run(({ outbox }) => outbox.enqueue(duplicate)),
  ])
  assert.equal(
    (
      await pool.query('SELECT count(*)::int AS count FROM app.outbox_messages WHERE id = $1', [
        duplicate.id,
      ])
    ).rows[0].count,
    1,
  )
  const runtimeClient = await pool.connect()
  try {
    await runtimeClient.query('SET ROLE app_runtime')
    assert.equal(
      (await runtimeClient.query('SELECT current_user AS role')).rows[0].role,
      'app_runtime',
    )
    const runtime = createTransactionAdapter(drizzle({ client: runtimeClient }), {
      outboxPolicies: policies,
      auditPolicies: { 'test.audit': { requireReason: false, changeFields: [] } },
    })
    const accepted = intent()
    await runtime.run(({ outbox }) => outbox.enqueue(accepted))
    assert.equal(
      (await pool.query('SELECT id FROM app.outbox_messages WHERE id = $1', [accepted.id]))
        .rowCount,
      1,
    )
    const denied = intent()
    const auditId = randomUUID()
    await pool.query('REVOKE INSERT ON app.outbox_messages FROM app_runtime')
    try {
      await assert.rejects(
        runtime.run(async ({ competition, audit, outbox }) => {
          await competition.createCompetition({
            id: denied.aggregateId,
            displayName: 'Outbox failure rollback',
          })
          await audit.append({
            id: auditId,
            actor: { kind: 'system', displayName: 'Synthetic Outbox verifier' },
            action: 'test.audit',
            outcome: 'succeeded',
            source: 'job',
            correlationKey: 'synthetic-outbox',
            targets: [],
          })
          await outbox.enqueue(denied).catch(() => undefined)
        }),
        (error: unknown) =>
          error instanceof OutboxFailure &&
          error.kind === 'unavailable' &&
          error.message === 'Outbox unavailable' &&
          error.cause === undefined,
      )
    } finally {
      await pool.query('GRANT INSERT ON app.outbox_messages TO app_runtime')
    }
    for (const [table, id] of [
      ['competitions', denied.aggregateId],
      ['audit_events', auditId],
      ['outbox_messages', denied.id],
    ]) {
      assert.equal(
        (await pool.query(`SELECT id FROM app.${table} WHERE id = $1`, [id])).rowCount,
        0,
        'Partial mutation survived Outbox failure',
      )
    }
  } finally {
    await runtimeClient.query('RESET ROLE')
    runtimeClient.release()
  }
  console.info('Transactional Outbox verification passed')
} finally {
  // Only this invocation's synthetic mutable queue fixtures, never Audit History or shared data.
  await pool.query('DELETE FROM app.outbox_messages WHERE id = ANY($1::uuid[])', [fixtureIds])
  await pool.end()
}
