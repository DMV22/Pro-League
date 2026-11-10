import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import {
  executeAdminCommand,
  CommandConflict,
  type AdminCommandDefinition,
} from '../../src/application/commands/execute-admin-command'
import { createTransactionAdapter } from '../../src/server/db/transaction'
import { createProtectedCommandTransaction } from '../../src/server/commands/protected-command'
import { assertIntegrationTarget } from './integration-target'
import { loadProjectEnv } from './load-env'
import { executorScenario, withExecutorFixtures } from './command-executor-fixtures'

loadProjectEnv()
const target = process.argv.find((arg) => arg.startsWith('--target='))?.slice(9)
assert(target === 'local' || target === 'ci', 'Specify integration target')
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm-db='))?.slice(13)
const url = assertIntegrationTarget(process.env.INTEGRATION_DATABASE_URL, target, confirmation)
const pool = new pg.Pool({
  connectionString: url,
  max: 6,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 8_000,
})
const database = drizzle({ client: pool })
await withExecutorFixtures(pool, async ({ request, actor }) => {
  const { identityId, grantId, subject } = await executorScenario(
    pool,
    'synthetic Admin setup',
    async () => actor(),
  )
  const transaction = createProtectedCommandTransaction(database, {
    auditPolicies: {
      'test.command': { requireReason: false, changeFields: [] },
      'test.command_other': { requireReason: false, changeFields: [] },
      'test.rename': { requireReason: false, changeFields: [] },
    },
    outboxPolicies: { 'test.command_effect': { schemaVersion: 1, payloadFields: ['entityId'] } },
  })
  const session = {
    async verify() {
      return {
        subject,
        sessionId: 'synthetic-completed-session',
        startedAt: Date.parse('2026-01-01'),
      }
    },
  }
  const definition: AdminCommandDefinition<{ id: string }> = {
    type: 'test.command',
    version: 1,
    resultFields: ['id', 'version'],
    validate(payload) {
      if (
        payload &&
        typeof payload === 'object' &&
        'id' in payload &&
        typeof payload.id === 'string' &&
        /^[0-9a-f-]{36}$/.test(payload.id)
      )
        return { valid: true, value: { id: payload.id } }
      return { valid: false, issues: [{ field: 'payload', code: 'invalid_format' }] }
    },
    async run(request, _context, { competition }) {
      const row = await competition.createCompetition({
        id: request.payload.id,
        displayName: 'Synthetic executor fixture',
      })
      return {
        value: { id: row.id, version: row.version.toString() },
        audit: {
          targets: [{ role: 'primary', type: 'competition', id: row.id, version: row.version }],
        },
        outbox: [
          {
            key: 'effect',
            messageType: 'test.command_effect',
            schemaVersion: 1,
            payload: { entityId: row.id },
            aggregateType: 'competition',
            aggregateId: row.id,
            aggregateVersion: row.version,
          },
        ],
      }
    },
  }
  const auditFaultCorrelation = `audit-${randomUUID()}`
  const outboxFaultCorrelation = `outbox-${randomUUID()}`
  const execute = (input: unknown, command = definition) =>
    executeAdminCommand({ session, transaction }, command, input, {
      correlationKey: `executor-${randomUUID()}`,
    })
  await executorScenario(
    pool,
    'partial session acquisition does not leak the first client',
    async () => {
      const limited = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 500 })
      await withExecutorFixtures(limited, async () => {
        await assert.rejects(
          executorScenario(limited, 'synthetic pool exhaustion', async (resources) => {
            await resources.client()
            await resources.client()
          }),
          (error: unknown) =>
            error instanceof AggregateError &&
            error.errors.length === 1 &&
            error.cause instanceof Error &&
            /timeout/.test(error.cause.message),
        )
        assert.equal(limited.totalCount, 0, 'Partially acquired session was not destroyed')
      })
    },
  )
  await executorScenario(
    pool,
    'failed scenario releases sessions, rolls back and removes fault objects',
    async () => {
      const input = request()
      const ownedObjects = async () =>
        (
          await pool.query<{ name: string }>(
            `SELECT 'relation:' || relname AS name FROM pg_class
       WHERE relnamespace = 'app'::regnamespace AND starts_with(relname, 'executor_fixture_')
       UNION ALL SELECT 'function:' || proname FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND starts_with(proname, 'executor_fixture_')
       UNION ALL SELECT 'trigger:' || tgname FROM pg_trigger
       WHERE starts_with(tgname, 'executor_fixture_') ORDER BY name`,
          )
        ).rows
      const before = await ownedObjects()
      let pid: number | undefined
      const original = new Error('synthetic scenario assertion failure')
      await assert.rejects(
        executorScenario(pool, 'synthetic aborted scenario', async (resources) => {
          const client = await resources.client({ runtime: true, notice() {} })
          pid = (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
          await resources.retryFault({
            retry: request(),
            exhausted: request(),
            noRetry: request(),
            lostSession: request(),
            switchedActor: request(),
          })
          await resources.outcomeFault(input)
          await client.query('BEGIN')
          await client.query('INSERT INTO app.competitions (id, display_name) VALUES ($1, $2)', [
            input.payload.id,
            'Synthetic uncommitted fixture',
          ])
          throw original
        }),
        (error: unknown) =>
          error instanceof AggregateError &&
          error.cause === original &&
          error.errors[0] === original &&
          error.message.includes('synthetic aborted scenario'),
      )
      assert.deepEqual(await ownedObjects(), before, 'Failed scenario leaked a fault object')
      assert.equal(
        (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [input.payload.id]))
          .rowCount,
        0,
      )
      // Destruction is asynchronous on the server; wait for this exact owned backend to disappear.
      for (let attempt = 0; attempt < 100; attempt++) {
        if (!(await pool.query('SELECT 1 FROM pg_stat_activity WHERE pid = $1', [pid])).rowCount)
          break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      assert.equal(
        (await pool.query('SELECT 1 FROM pg_stat_activity WHERE pid = $1', [pid])).rowCount,
        0,
        'Failed scenario leaked a dedicated session',
      )
    },
  )
  await executorScenario(pool, 'protected composition and safe failure evidence', async () => {
    const protectedTransaction = createProtectedCommandTransaction(database)
    for (const policy of [
      { requireReason: false, changeFields: [] },
      { requireReason: true, changeFields: ['unsafeField'] },
      { requireReason: true, requireReference: true, changeFields: [] },
    ])
      assert.throws(
        () =>
          createProtectedCommandTransaction(database, {
            auditPolicies: { 'admin.command_attempt': policy },
          }),
        /Reserved command failure Audit policy/,
        'Conflicting reserved failure policy must fail during trusted composition',
      )
    const protectedCorrelation = `protected-default-${randomUUID()}`
    assert.deepEqual(
      await executeAdminCommand(
        { session, transaction: protectedTransaction },
        definition,
        { idempotencyKey: 'invalid-protected-request', payload: null },
        { correlationKey: protectedCorrelation },
      ),
      { status: 'invalid', issues: [{ field: 'payload', code: 'invalid_format' }] },
    )
    assert.deepEqual(
      (
        await pool.query(
          'SELECT action, outcome, reason FROM app.audit_events WHERE correlation_key = $1',
          [protectedCorrelation],
        )
      ).rows,
      [{ action: 'admin.command_attempt', outcome: 'failed', reason: 'test.command:invalid' }],
      'Protected composition must supply mandatory failure evidence without manual policy registration',
    )
    const suppliedPolicy = {
      requireReason: true,
      requireReference: false,
      changeFields: [] as string[],
    }
    const suppliedPolicies = { 'admin.command_attempt': suppliedPolicy }
    const protectedSnapshot = createProtectedCommandTransaction(database, {
      auditPolicies: suppliedPolicies,
    })
    suppliedPolicy.requireReason = false
    suppliedPolicy.requireReference = true
    suppliedPolicy.changeFields.push('rawPayload')
    suppliedPolicies['admin.command_attempt'] = {
      requireReason: false,
      requireReference: true,
      changeFields: ['privateContent'],
    }
    const snapshotCorrelation = `protected-snapshot-${randomUUID()}`
    assert.deepEqual(
      await executeAdminCommand(
        { session, transaction: protectedSnapshot },
        definition,
        { idempotencyKey: 'invalid-protected-snapshot', payload: null },
        { correlationKey: snapshotCorrelation },
      ),
      { status: 'invalid', issues: [{ field: 'payload', code: 'invalid_format' }] },
      'Caller mutation cannot weaken the reserved protected policy',
    )
    assert.equal(
      (
        await pool.query('SELECT id FROM app.audit_events WHERE correlation_key = $1', [
          snapshotCorrelation,
        ])
      ).rowCount,
      1,
    )
    const genericCorrelation = `generic-empty-${randomUUID()}`
    assert.deepEqual(
      await executeAdminCommand(
        { session, transaction: createTransactionAdapter(database) },
        definition,
        { idempotencyKey: 'invalid-generic-request', payload: null },
        { correlationKey: genericCorrelation },
      ),
      { status: 'unavailable', code: 'audit_unavailable' },
    )
    assert.equal(
      (
        await pool.query('SELECT id FROM app.audit_events WHERE correlation_key = $1', [
          genericCorrelation,
        ])
      ).rowCount,
      0,
      'Generic transaction registries must remain empty by default',
    )
    const unregistered = request()
    assert.deepEqual(
      await executeAdminCommand(
        { session, transaction: protectedTransaction },
        definition,
        unregistered,
        { correlationKey: `unregistered-${randomUUID()}` },
      ),
      { status: 'unavailable', code: 'audit_unavailable' },
    )
    assert.equal(
      (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [unregistered.payload.id]))
        .rowCount,
      0,
      'Failure-Audit registration does not enable accepted business actions',
    )
    const unexpectedCorrelation = `unexpected-${randomUUID()}`
    const unexpectedInput = request()
    assert.deepEqual(
      await executeAdminCommand(
        { session, transaction },
        {
          ...definition,
          async run() {
            throw new Error('synthetic-private-provider-message')
          },
        },
        unexpectedInput,
        { correlationKey: unexpectedCorrelation },
      ),
      { status: 'unavailable', code: 'unexpected_failure' },
    )
    const unexpectedEvidence = (
      await pool.query(
        'SELECT action, outcome, reason FROM app.audit_events WHERE correlation_key = $1',
        [unexpectedCorrelation],
      )
    ).rows
    assert.deepEqual(unexpectedEvidence, [
      { action: 'admin.command_attempt', outcome: 'failed', reason: 'test.command:unavailable' },
    ])
    assert(!JSON.stringify(unexpectedEvidence).includes('synthetic-private-provider-message'))
  })
  await executorScenario(pool, 'persisted intent compatibility', async () => {
    // Compatibility fixture: pin persisted identity bytes before the policy refactor.
    const compatibilityId = '019b0000-0000-7000-8000-000000000127'
    request(compatibilityId)
    const compatibilityInput = {
      idempotencyKey: 'compat-intent-127',
      payload: { id: compatibilityId },
    }
    assert.deepEqual(await execute(compatibilityInput), {
      status: 'succeeded',
      value: { id: compatibilityId, version: '1' },
    })
    const compatibilityRow = (
      await pool.query(
        'SELECT actor_scope, payload_hash, result_type, result_schema_version, result_payload FROM app.command_executions WHERE idempotency_key = $1 AND actor_scope LIKE $2',
        [compatibilityInput.idempotencyKey, `%${grantId}%`],
      )
    ).rows[0]
    assert.equal(
      compatibilityRow.actor_scope,
      `["admin-v1","${identityId}","${grantId}","test.command"]`,
    )
    assert.equal(
      compatibilityRow.payload_hash,
      '6d2496c14c7360ae3c7c9d6625eb16c0b96f942212cbdc30c1ca619646de8ab0',
      'Persisted canonical intent hash changed',
    )
    assert.equal(compatibilityRow.result_type, 'test.command')
    assert.equal(compatibilityRow.result_schema_version, 1)
    assert.deepEqual(compatibilityRow.result_payload, { id: compatibilityId, version: '1' })
    await pool.query(
      "UPDATE app.command_executions SET result_type = 'test.other', state = 'failed' WHERE idempotency_key = $1 AND actor_scope = $2",
      [compatibilityInput.idempotencyKey, compatibilityRow.actor_scope],
    )
    assert.deepEqual(
      await execute(compatibilityInput),
      { status: 'conflict', code: 'idempotency_conflict' },
      'Changed stored intent type is a conflict even when replay state is unusable',
    )
    await pool.query(
      "UPDATE app.command_executions SET result_type = 'test.command', state = 'succeeded' WHERE idempotency_key = $1 AND actor_scope = $2",
      [compatibilityInput.idempotencyKey, compatibilityRow.actor_scope],
    )
    assert.equal((await execute(compatibilityInput)).status, 'succeeded')
  })
  const first = request()
  const accepted = { status: 'succeeded', value: { id: first.payload.id, version: '1' } }
  const { identityId: secondIdentity, subject: secondSubject } = await actor()
  await executorScenario(
    pool,
    'replay rejects changed intent and isolates command and actor scope',
    async () => {
      assert.deepEqual(await execute(first), accepted)
      assert.deepEqual(await execute(first), accepted, 'Replay must return the recorded result')
      assert.equal(
        Number(
          (
            await pool.query('SELECT count(*) FROM app.outbox_messages WHERE aggregate_id = $1', [
              first.payload.id,
            ])
          ).rows[0].count,
        ),
        1,
      )
      const changed = request()
      assert.deepEqual(await execute({ ...changed, idempotencyKey: first.idempotencyKey }), {
        status: 'conflict',
        code: 'idempotency_conflict',
      })
      const scopeInput = request()
      assert.deepEqual(
        await execute(
          { ...scopeInput, idempotencyKey: first.idempotencyKey },
          { ...definition, type: 'test.command_other' },
        ),
        { status: 'succeeded', value: { id: scopeInput.payload.id, version: '1' } },
        'A command type has its own execution scope',
      )
      const versionedInput = {
        ...request(),
        expectedVersion: { id: first.payload.id, expectedVersion: '1' },
      }
      assert.equal((await execute(versionedInput)).status, 'succeeded')
      assert.deepEqual(
        await execute({
          ...versionedInput,
          expectedVersion: { ...versionedInput.expectedVersion, expectedVersion: '2' },
        }),
        { status: 'conflict', code: 'idempotency_conflict' },
      )
      const otherActorInput = { ...request(), idempotencyKey: first.idempotencyKey }
      assert.deepEqual(
        await executeAdminCommand(
          {
            transaction,
            session: {
              async verify() {
                return {
                  subject: secondSubject,
                  sessionId: 'synthetic-other-session',
                  startedAt: Date.parse('2026-01-01'),
                }
              },
            },
          },
          definition,
          otherActorInput,
          { correlationKey: `actor-${randomUUID()}` },
        ),
        { status: 'succeeded', value: { id: otherActorInput.payload.id, version: '1' } },
        'One actor cannot replay another actor result',
      )
    },
  )
  await executorScenario(pool, 'canonical payload and concurrent replay', async () => {
    const canonicalInput = request()
    const canonicalDefinition: AdminCommandDefinition<{
      id: string
      flags: Record<string, boolean>
    }> = {
      ...definition,
      validate(payload) {
        const parsed = definition.validate(payload)
        if (!parsed.valid) return parsed
        return {
          valid: true,
          value: {
            ...parsed.value,
            flags: (payload as { flags: Record<string, boolean> }).flags,
          },
        }
      },
    }
    assert.equal(
      (
        await executeAdminCommand(
          { session, transaction },
          canonicalDefinition,
          {
            ...canonicalInput,
            payload: { ...canonicalInput.payload, flags: { alpha: true, beta: false } },
          },
          { correlationKey: 'canonical-one' },
        )
      ).status,
      'succeeded',
    )
    assert.equal(
      (
        await executeAdminCommand(
          { session, transaction },
          canonicalDefinition,
          {
            ...canonicalInput,
            payload: { flags: { beta: false, alpha: true }, id: canonicalInput.payload.id },
          },
          { correlationKey: 'canonical-two' },
        )
      ).status,
      'succeeded',
    )
    const concurrent = request()
    const both = await Promise.all([execute(concurrent), execute(concurrent)])
    assert.deepEqual(both, [
      { status: 'succeeded', value: { id: concurrent.payload.id, version: '1' } },
      { status: 'succeeded', value: { id: concurrent.payload.id, version: '1' } },
    ])
    assert.equal(
      Number(
        (
          await pool.query('SELECT count(*) FROM app.audit_event_targets WHERE target_id = $1', [
            concurrent.payload.id,
          ])
        ).rows[0].count,
      ),
      1,
    )
  })
  await executorScenario(pool, 'replay requires current access', async (resources) => {
    await resources.suspendGrant(grantId)
    assert.deepEqual(
      await execute(first),
      { status: 'forbidden', code: 'access_denied' },
      'Replay requires current access',
    )
  })
  await executorScenario(pool, 'Audit and Outbox failure roll back accepted effects', async () => {
    const unavailableAudit = createProtectedCommandTransaction(database, {
      outboxPolicies: {
        'test.command_effect': { schemaVersion: 1, payloadFields: ['entityId'] },
      },
    })
    const rejected = request()
    assert.deepEqual(
      await executeAdminCommand({ session, transaction: unavailableAudit }, definition, rejected, {
        correlationKey: auditFaultCorrelation,
      }),
      { status: 'unavailable', code: 'audit_unavailable' },
    )
    assert.equal(
      (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [rejected.payload.id]))
        .rowCount,
      0,
    )
    const failedOutbox = request()
    const noOutboxPolicy = createProtectedCommandTransaction(database, {
      auditPolicies: {
        'test.command': { requireReason: false, changeFields: [] },
      },
    })
    assert.deepEqual(
      await executeAdminCommand(
        { session, transaction: noOutboxPolicy },
        definition,
        failedOutbox,
        {
          correlationKey: outboxFaultCorrelation,
        },
      ),
      { status: 'unavailable', code: 'persistence_unavailable' },
    )
    assert.equal(
      (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [failedOutbox.payload.id]))
        .rowCount,
      0,
    )
    assert.equal(
      (
        await pool.query(
          'SELECT id FROM app.audit_events WHERE correlation_key = $1 AND outcome = $2',
          [outboxFaultCorrelation, 'succeeded'],
        )
      ).rowCount,
      0,
    )
    const failedEvidence = await pool.query(
      'SELECT action, outcome FROM app.audit_events WHERE correlation_key = $1',
      [outboxFaultCorrelation],
    )
    assert.deepEqual(failedEvidence.rows, [{ action: 'admin.command_attempt', outcome: 'failed' }])
  })
  await executorScenario(pool, 'safe result projection and effect budgets', async () => {
    const invalidOutput = request()
    assert.deepEqual(
      await execute(invalidOutput, {
        ...definition,
        async run(...args) {
          const result = await definition.run(...args)
          return { ...result, value: { id: result.value.id, password: 'not-a-safe-projection' } }
        },
      }),
      { status: 'unavailable', code: 'persistence_unavailable' },
    )
    assert.equal(
      (
        await pool.query('SELECT id FROM app.competitions WHERE id = $1', [
          invalidOutput.payload.id,
        ])
      ).rowCount,
      0,
    )
    const largestBatch = request()
    const largestBatchResult = await execute(largestBatch, {
      ...definition,
      resultFields: ['id', 'version', ...Array.from({ length: 14 }, (_, index) => `field${index}`)],
      async run(...args) {
        const result = await definition.run(...args)
        return {
          ...result,
          outbox: Array.from({ length: 16 }, (_, index) => ({
            ...result.outbox![0],
            key: `effect-${index}`,
          })),
        }
      },
    })
    assert.equal(largestBatchResult.status, 'succeeded')
    assert.equal(
      Number(
        (
          await pool.query(
            'SELECT count(DISTINCT id) FROM app.outbox_messages WHERE aggregate_id = $1',
            [largestBatch.payload.id],
          )
        ).rows[0].count,
      ),
      16,
    )
    for (const mode of [
      'too_many',
      'duplicate_key',
      'invalid_key',
      'too_many_result_fields',
    ] as const) {
      const input = request()
      const command = {
        ...definition,
        resultFields:
          mode === 'too_many_result_fields'
            ? ['id', 'version', ...Array.from({ length: 15 }, (_, index) => `field${index}`)]
            : definition.resultFields,
        async run(...args: Parameters<typeof definition.run>) {
          const result = await definition.run(...args)
          return {
            ...result,
            outbox:
              mode === 'too_many'
                ? Array.from({ length: 17 }, (_, index) => ({
                    ...result.outbox![0],
                    key: `effect-${index}`,
                  }))
                : mode === 'duplicate_key'
                  ? [result.outbox![0], result.outbox![0]]
                  : mode === 'invalid_key'
                    ? [{ ...result.outbox![0], key: 'invalid key' }]
                    : result.outbox,
          }
        },
      }
      assert.deepEqual(
        await execute(input, command),
        { status: 'unavailable', code: 'persistence_unavailable' },
        `Existing intent limit changed: ${mode}`,
      )
      assert.equal(
        (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [input.payload.id]))
          .rowCount,
        0,
      )
    }
  })
  await executorScenario(
    pool,
    'revalidate access after an in-flight revocation',
    async (resources) => {
      const raceInput = request()
      assert.deepEqual(await resources.revokeWhile(grantId, () => execute(raceInput)), {
        status: 'forbidden',
        code: 'access_denied',
      })
      assert.equal(
        (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [raceInput.payload.id]))
          .rowCount,
        0,
      )
    },
  )
  await executorScenario(pool, 'optimistic conflicts and immutable recorded outcomes', async () => {
    // Real optimistic version checks remain owned by the synthetic module command.
    const renameDefinition: typeof definition = {
      ...definition,
      type: 'test.rename',
      async run(command, _context, { competition }) {
        const expected = command.expectedVersion
        const current = await competition.findCompetition(command.payload.id)
        if (
          !expected ||
          expected.id !== command.payload.id ||
          !current ||
          current.version !== expected.expectedVersion
        )
          throw new CommandConflict('stale_version')
        const row = await competition.renameCompetition({
          ...expected,
          displayName: 'Synthetic renamed fixture',
        })
        return {
          value: { id: row.id, version: row.version.toString() },
          audit: {
            targets: [{ role: 'primary', type: 'competition', id: row.id, version: row.version }],
          },
        }
      },
    }
    const renameRequest = {
      idempotencyKey: randomUUID(),
      payload: first.payload,
      expectedVersion: { id: first.payload.id, expectedVersion: '1' },
    }
    assert.deepEqual(await execute(renameRequest, renameDefinition), {
      status: 'succeeded',
      value: { id: first.payload.id, version: '2' },
    })
    assert.deepEqual(await execute(renameRequest, renameDefinition), {
      status: 'succeeded',
      value: { id: first.payload.id, version: '2' },
    })
    assert.deepEqual(
      await execute({ ...renameRequest, idempotencyKey: randomUUID() }, renameDefinition),
      { status: 'conflict', code: 'stale_version' },
    )
    assert.deepEqual(
      await execute(first),
      accepted,
      'Create replay must not reconstruct a newer domain version',
    )
    // Version conflicts are explicit, not blanket retryable persistence errors.
    const staleInput = request()
    assert.deepEqual(
      await execute(staleInput, {
        ...definition,
        async run() {
          throw new CommandConflict('stale_version')
        },
      }),
      { status: 'conflict', code: 'stale_version' },
    )
  })
  await executorScenario(pool, 'restricted app_runtime command execution', async (resources) => {
    const runtimeClient = await resources.client({ runtime: true })
    const runtimeTransaction = createProtectedCommandTransaction(
      drizzle({ client: runtimeClient }),
      {
        auditPolicies: {
          'test.command': { requireReason: false, changeFields: [] },
        },
        outboxPolicies: {
          'test.command_effect': { schemaVersion: 1, payloadFields: ['entityId'] },
        },
      },
    )
    const runtimeInput = request()
    assert.equal(
      (
        await executeAdminCommand(
          { session, transaction: runtimeTransaction },
          definition,
          runtimeInput,
          { correlationKey: `runtime-${randomUUID()}` },
        )
      ).status,
      'succeeded',
    )
  })

  // Inject PostgreSQL SQLSTATEs using invocation-owned objects; sequence changes survive rollback.
  await executorScenario(
    pool,
    'bounded retries with stable intent and fresh authorization',
    async (resources) => {
      const retryInput = request()
      const exhaustedInput = request()
      const noRetryInput = request()
      const lostSessionInput = request()
      const switchedActorInput = request()
      await resources.retryFault({
        retry: retryInput,
        exhausted: exhaustedInput,
        noRetry: noRetryInput,
        lostSession: lostSessionInput,
        switchedActor: switchedActorInput,
      })
      const attempts: unknown[] = []
      const retryDefinition: typeof definition = {
        ...definition,
        async run(...args) {
          attempts.push(structuredClone(args[0]))
          return definition.run(...args)
        },
      }
      const observedIntentIds: string[] = []
      const captureNotice = (notice: { message?: string }) => {
        if (notice.message?.startsWith('synthetic-intent:'))
          observedIntentIds.push(notice.message.slice(17))
      }
      await executorScenario(
        pool,
        'retry preserves the external effect identity',
        async (retryResources) => {
          const retryClient = await retryResources.client({ notice: captureNotice })
          const retryTransaction = createProtectedCommandTransaction(
            drizzle({ client: retryClient }),
            {
              auditPolicies: {
                'test.command': { requireReason: false, changeFields: [] },
              },
              outboxPolicies: {
                'test.command_effect': { schemaVersion: 1, payloadFields: ['entityId'] },
              },
            },
          )
          assert.deepEqual(
            await executeAdminCommand(
              { session, transaction: retryTransaction },
              retryDefinition,
              retryInput,
              { correlationKey: `retry-${randomUUID()}` },
            ),
            { status: 'succeeded', value: { id: retryInput.payload.id, version: '1' } },
          )
        },
      )
      assert.equal(observedIntentIds.length, 2)
      assert.equal(
        observedIntentIds[0],
        observedIntentIds[1],
        'Retry allocated another external effect identity',
      )
      assert.equal(attempts.length, 2)
      assert.deepEqual(attempts[0], attempts[1], 'Transient retry changed the validated intent')
      assert.equal(
        Number(
          (
            await pool.query('SELECT count(*) FROM app.outbox_messages WHERE aggregate_id = $1', [
              retryInput.payload.id,
            ])
          ).rows[0].count,
        ),
        1,
      )
      assert.equal(
        Number(
          (
            await pool.query('SELECT count(*) FROM app.audit_event_targets WHERE target_id = $1', [
              retryInput.payload.id,
            ])
          ).rows[0].count,
        ),
        1,
      )
      const exhaustedAttempts: unknown[] = []
      assert.deepEqual(
        await execute(exhaustedInput, {
          ...definition,
          async run(...args) {
            exhaustedAttempts.push(structuredClone(args[0]))
            return definition.run(...args)
          },
        }),
        { status: 'unavailable', code: 'persistence_unavailable' },
      )
      assert.equal(
        exhaustedAttempts.length,
        3,
        'Only three transient transaction attempts are permitted',
      )
      assert.equal(
        (
          await pool.query('SELECT id FROM app.competitions WHERE id = $1', [
            exhaustedInput.payload.id,
          ])
        ).rowCount,
        0,
      )
      const nonTransientAttempts: unknown[] = []
      assert.deepEqual(
        await execute(noRetryInput, {
          ...definition,
          async run(...args) {
            nonTransientAttempts.push(args[0])
            return definition.run(...args)
          },
        }),
        { status: 'unavailable', code: 'persistence_unavailable' },
      )
      assert.equal(
        nonTransientAttempts.length,
        1,
        'A constraint/domain conflict must not be retried',
      )
      let sessionChecks = 0
      assert.deepEqual(
        await executeAdminCommand(
          {
            transaction,
            session: {
              async verify() {
                return ++sessionChecks === 1
                  ? {
                      subject,
                      sessionId: 'synthetic-before-expiry',
                      startedAt: Date.parse('2026-01-01'),
                    }
                  : null
              },
            },
          },
          definition,
          lostSessionInput,
          { correlationKey: `expired-${randomUUID()}` },
        ),
        { status: 'unauthenticated' },
      )
      assert.equal(sessionChecks, 2)
      let actorChecks = 0
      assert.deepEqual(
        await executeAdminCommand(
          {
            transaction,
            session: {
              async verify() {
                return {
                  subject: ++actorChecks === 1 ? subject : secondSubject,
                  sessionId: 'synthetic-changing-session',
                  startedAt: Date.parse('2026-01-01'),
                }
              },
            },
          },
          definition,
          switchedActorInput,
          { correlationKey: `changed-actor-${randomUUID()}` },
        ),
        { status: 'forbidden', code: 'access_denied' },
      )
      assert.equal(
        (
          await pool.query('SELECT id FROM app.competitions WHERE id = ANY($1::uuid[])', [
            [lostSessionInput.payload.id, switchedActorInput.payload.id],
          ])
        ).rowCount,
        0,
      )
    },
  )
  await executorScenario(
    pool,
    'outcome storage failure rolls back all accepted effects',
    async (resources) => {
      const outcomeFault = request()
      await resources.outcomeFault(outcomeFault)
      assert.deepEqual(await execute(outcomeFault), {
        status: 'unavailable',
        code: 'persistence_unavailable',
      })
      assert.equal(
        (
          await pool.query('SELECT id FROM app.competitions WHERE id = $1', [
            outcomeFault.payload.id,
          ])
        ).rowCount,
        0,
      )
      assert.equal(
        (
          await pool.query('SELECT id FROM app.outbox_messages WHERE aggregate_id = $1', [
            outcomeFault.payload.id,
          ])
        ).rowCount,
        0,
      )
      assert.equal(
        (
          await pool.query('SELECT id FROM app.audit_event_targets WHERE target_id = $1', [
            outcomeFault.payload.id,
          ])
        ).rowCount,
        0,
      )
      assert.equal(
        (
          await pool.query('SELECT id FROM app.command_executions WHERE idempotency_key = $1', [
            outcomeFault.idempotencyKey,
          ])
        ).rowCount,
        0,
      )
    },
  )
  await executorScenario(
    pool,
    'legacy replay, expiry, forged actor and missing evidence',
    async () => {
      // Recorded outcomes never silently rerun after a missing/unsupported replay payload.
      const legacy = request()
      assert.equal((await execute(legacy)).status, 'succeeded')
      for (const values of [
        { version: 0, payload: {} },
        { version: 1, payload: [] },
        { version: null, payload: {} },
        { version: 1, payload: { oversized: 'x'.repeat(8192) } },
      ])
        await assert.rejects(
          pool.query(
            'UPDATE app.command_executions SET result_schema_version = $2, result_payload = $3::jsonb WHERE idempotency_key = $1',
            [legacy.idempotencyKey, values.version, JSON.stringify(values.payload)],
          ),
          (error: unknown) =>
            error !== null &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === '23514',
        )
      await pool.query(
        'UPDATE app.command_executions SET result_schema_version = 2 WHERE idempotency_key = $1',
        [legacy.idempotencyKey],
      )
      assert.deepEqual(await execute(legacy), {
        status: 'unavailable',
        code: 'persistence_unavailable',
      })
      await pool.query(
        "UPDATE app.command_executions SET result_schema_version = 1, expires_at = now() - interval '1 day' WHERE idempotency_key = $1",
        [legacy.idempotencyKey],
      )
      assert.equal(
        (await execute(legacy)).status,
        'succeeded',
        'Operational expiry never authorizes a duplicate domain effect',
      )
      await pool.query(
        'UPDATE app.command_executions SET result_payload = null, result_schema_version = null WHERE idempotency_key = $1',
        [legacy.idempotencyKey],
      )
      assert.deepEqual(await execute(legacy), {
        status: 'unavailable',
        code: 'persistence_unavailable',
      })
      assert.equal(
        Number(
          (
            await pool.query('SELECT count(*) FROM app.outbox_messages WHERE aggregate_id = $1', [
              legacy.payload.id,
            ])
          ).rows[0].count,
        ),
        1,
      )
      const forged = request()
      assert.deepEqual(await execute({ ...forged, actor: { adminIdentityId: secondIdentity } }), {
        status: 'invalid',
        issues: [{ field: 'command', code: 'unknown_field' }],
      })
      assert.equal(
        (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [forged.payload.id]))
          .rowCount,
        0,
      )
      const failureLoggingUnavailable = createTransactionAdapter(database)
      assert.deepEqual(
        await executeAdminCommand(
          { session, transaction: failureLoggingUnavailable },
          definition,
          request(),
          { correlationKey: `unaudited-${randomUUID()}` },
        ),
        { status: 'unavailable', code: 'audit_unavailable' },
        'Do not claim missing failure evidence was recorded',
      )
    },
  )
})
console.info('Protected command executor verification passed')
