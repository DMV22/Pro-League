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
const identityId = randomUUID(),
  grantId = randomUUID(),
  externalId = randomUUID()
const subject = `synthetic-${randomUUID()}`
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
    return { subject, sessionId: 'synthetic-completed-session' }
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
const entityIds: string[] = []
const auditFaultCorrelation = `audit-${randomUUID()}`
const outboxFaultCorrelation = `outbox-${randomUUID()}`
const request = () => {
  const id = randomUUID()
  entityIds.push(id)
  return { idempotencyKey: randomUUID(), payload: { id } }
}
const execute = (input: unknown, command = definition) =>
  executeAdminCommand({ session, transaction }, command, input, {
    correlationKey: `executor-${randomUUID()}`,
  })
try {
  await pool.query(
    'INSERT INTO app.admin_identities (id, display_name, contact_email, normalized_email) VALUES ($1, $2, $3, $3)',
    [identityId, 'Synthetic executor Admin', `${identityId}@example.invalid`],
  )
  await pool.query(
    'INSERT INTO app.admin_external_identities (id, admin_identity_id, provider_user_id, last_synchronized_at) VALUES ($1, $2, $3, now())',
    [externalId, identityId, subject],
  )
  await pool.query(
    "INSERT INTO app.admin_access_grants (id, admin_identity_id, source, state, effective_at) VALUES ($1, $2, 'bootstrap', 'active', now())",
    [grantId, identityId],
  )
  const first = request()
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
  // Compatibility fixture: pin persisted identity bytes before the policy refactor.
  const compatibilityId = '019b0000-0000-7000-8000-000000000127'
  entityIds.push(compatibilityId)
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
  const accepted = { status: 'succeeded', value: { id: first.payload.id, version: '1' } }
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
  const secondIdentity = randomUUID(),
    secondGrant = randomUUID(),
    secondSubject = `synthetic-${randomUUID()}`
  await pool.query(
    'INSERT INTO app.admin_identities (id, display_name, contact_email, normalized_email) VALUES ($1, $2, $3, $3)',
    [secondIdentity, 'Synthetic second actor', `${secondIdentity}@example.invalid`],
  )
  await pool.query(
    'INSERT INTO app.admin_external_identities (id, admin_identity_id, provider_user_id, last_synchronized_at) VALUES ($1, $2, $3, now())',
    [randomUUID(), secondIdentity, secondSubject],
  )
  await pool.query(
    "INSERT INTO app.admin_access_grants (id, admin_identity_id, source, state, effective_at) VALUES ($1, $2, 'bootstrap', 'active', now())",
    [secondGrant, secondIdentity],
  )
  const otherActorInput = { ...request(), idempotencyKey: first.idempotencyKey }
  assert.deepEqual(
    await executeAdminCommand(
      {
        transaction,
        session: {
          async verify() {
            return { subject: secondSubject, sessionId: 'synthetic-other-session' }
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
        value: { ...parsed.value, flags: (payload as { flags: Record<string, boolean> }).flags },
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
  await pool.query("UPDATE app.admin_access_grants SET state = 'suspended' WHERE id = $1", [
    grantId,
  ])
  assert.deepEqual(
    await execute(first),
    { status: 'forbidden', code: 'access_denied' },
    'Replay requires current access',
  )
  await pool.query("UPDATE app.admin_access_grants SET state = 'active' WHERE id = $1", [grantId])
  const unavailableAudit = createProtectedCommandTransaction(database, {
    outboxPolicies: { 'test.command_effect': { schemaVersion: 1, payloadFields: ['entityId'] } },
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
    await executeAdminCommand({ session, transaction: noOutboxPolicy }, definition, failedOutbox, {
      correlationKey: outboxFaultCorrelation,
    }),
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
    (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [invalidOutput.payload.id]))
      .rowCount,
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
  // Permission revalidation after waiting for an in-flight revocation (not a timing-only sleep).
  const holder = await pool.connect()
  const observer = await pool.connect()
  let pending: ReturnType<typeof execute> | undefined
  try {
    await holder.query('BEGIN')
    await holder.query(
      "UPDATE app.admin_access_grants SET state = 'revoked', ended_at = now() WHERE id = $1",
      [grantId],
    )
    const raceInput = request()
    pending = execute(raceInput)
    let waiting = false
    for (let n = 0; n < 100; n++) {
      const locked = await observer.query(
        "SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%admin_access_grants%' AND pid <> pg_backend_pid()",
      )
      if (locked.rowCount) {
        waiting = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert(waiting, 'Protected command did not wait on the current Grant lock')
    await holder.query('COMMIT')
    assert.deepEqual(await pending, { status: 'forbidden', code: 'access_denied' })
    pending = undefined
    assert.equal(
      (
        await observer.query('SELECT id FROM app.competitions WHERE id = $1', [
          raceInput.payload.id,
        ])
      ).rowCount,
      0,
    )
  } finally {
    await holder.query('ROLLBACK').catch(() => undefined)
    if (pending) await pending
    holder.release()
    observer.release()
    await pool.query(
      "UPDATE app.admin_access_grants SET state = 'active', ended_at = null WHERE id = $1",
      [grantId],
    )
  }
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

  // A real restricted runtime transaction must also be able to lock grants and persist outcomes.
  const runtimeClient = await pool.connect()
  try {
    await runtimeClient.query('SET ROLE app_runtime')
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
  } finally {
    await runtimeClient.query('RESET ROLE')
    runtimeClient.release()
  }

  // Inject PostgreSQL SQLSTATEs using invocation-owned objects; sequence changes survive rollback.
  const suffix = randomUUID().replaceAll('-', '')
  const sequenceName = `executor_fault_${suffix}`,
    functionName = `executor_fault_fn_${suffix}`,
    triggerName = `executor_fault_tr_${suffix}`
  const retryInput = request()
  const exhaustedInput = request()
  const noRetryInput = request()
  const lostSessionInput = request()
  const switchedActorInput = request()
  await pool.query(`CREATE SEQUENCE app.${sequenceName}`)
  try {
    await pool.query(`CREATE FUNCTION app.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.aggregate_id = '${retryInput.payload.id}' THEN RAISE NOTICE 'synthetic-intent:%', NEW.id; END IF;
      IF NEW.aggregate_id = '${retryInput.payload.id}' AND nextval('app.${sequenceName}') = 1 THEN
        RAISE EXCEPTION 'synthetic serialization failure' USING ERRCODE = '40001';
      ELSIF NEW.aggregate_id = '${exhaustedInput.payload.id}' THEN
        PERFORM nextval('app.${sequenceName}'); RAISE EXCEPTION 'synthetic deadlock' USING ERRCODE = '40P01';
      ELSIF NEW.aggregate_id = '${noRetryInput.payload.id}' THEN
        PERFORM nextval('app.${sequenceName}'); RAISE EXCEPTION 'synthetic constraint' USING ERRCODE = '23514';
      ELSIF NEW.aggregate_id IN ('${lostSessionInput.payload.id}', '${switchedActorInput.payload.id}') THEN
        RAISE EXCEPTION 'synthetic retry with renewed authentication' USING ERRCODE = '40001';
      END IF;
      RETURN NEW; END $$`)
    await pool.query(
      `CREATE TRIGGER ${triggerName} BEFORE INSERT ON app.outbox_messages FOR EACH ROW EXECUTE FUNCTION app.${functionName}()`,
    )
    const attempts: unknown[] = []
    const retryDefinition: typeof definition = {
      ...definition,
      async run(...args) {
        attempts.push(structuredClone(args[0]))
        return definition.run(...args)
      },
    }
    const retryClient = await pool.connect()
    const observedIntentIds: string[] = []
    const captureNotice = (notice: { message?: string }) => {
      if (notice.message?.startsWith('synthetic-intent:'))
        observedIntentIds.push(notice.message.slice(17))
    }
    retryClient.on('notice', captureNotice)
    try {
      const retryTransaction = createProtectedCommandTransaction(drizzle({ client: retryClient }), {
        auditPolicies: {
          'test.command': { requireReason: false, changeFields: [] },
        },
        outboxPolicies: {
          'test.command_effect': { schemaVersion: 1, payloadFields: ['entityId'] },
        },
      })
      assert.deepEqual(
        await executeAdminCommand(
          { session, transaction: retryTransaction },
          retryDefinition,
          retryInput,
          { correlationKey: `retry-${randomUUID()}` },
        ),
        { status: 'succeeded', value: { id: retryInput.payload.id, version: '1' } },
      )
    } finally {
      retryClient.off('notice', captureNotice)
      retryClient.release()
    }
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
    assert.equal(nonTransientAttempts.length, 1, 'A constraint/domain conflict must not be retried')
    let sessionChecks = 0
    assert.deepEqual(
      await executeAdminCommand(
        {
          transaction,
          session: {
            async verify() {
              return ++sessionChecks === 1
                ? { subject, sessionId: 'synthetic-before-expiry' }
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
  } finally {
    await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON app.outbox_messages`)
    await pool.query(`DROP FUNCTION IF EXISTS app.${functionName}()`)
    await pool.query(`DROP SEQUENCE app.${sequenceName}`)
  }
  const outcomeFault = request()
  const outcomeFunction = `executor_result_fn_${randomUUID().replaceAll('-', '')}`
  const outcomeTrigger = `executor_result_tr_${randomUUID().replaceAll('-', '')}`
  try {
    await pool.query(`CREATE FUNCTION app.${outcomeFunction}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.idempotency_key = '${outcomeFault.idempotencyKey}' THEN RAISE EXCEPTION 'synthetic outcome storage failure' USING ERRCODE = '23514'; END IF;
      RETURN NEW; END $$`)
    await pool.query(
      `CREATE TRIGGER ${outcomeTrigger} BEFORE UPDATE ON app.command_executions FOR EACH ROW EXECUTE FUNCTION app.${outcomeFunction}()`,
    )
    assert.deepEqual(await execute(outcomeFault), {
      status: 'unavailable',
      code: 'persistence_unavailable',
    })
    assert.equal(
      (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [outcomeFault.payload.id]))
        .rowCount,
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
  } finally {
    await pool.query(`DROP TRIGGER IF EXISTS ${outcomeTrigger} ON app.command_executions`)
    await pool.query(`DROP FUNCTION IF EXISTS app.${outcomeFunction}()`)
  }
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
        error !== null && typeof error === 'object' && 'code' in error && error.code === '23514',
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
  console.info('Protected command executor verification passed')
} finally {
  // Never delete immutable Audit History or its referenced Admin Identity.
  for (const id of entityIds) {
    await pool.query('DELETE FROM app.outbox_messages WHERE aggregate_id = $1', [id])
    await pool.query('DELETE FROM app.competitions WHERE id = $1', [id])
  }
  await pool.end()
}
