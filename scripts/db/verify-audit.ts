import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { createTransactionAdapter } from '../../src/server/db/transaction'
import { createPublicNavigationQueries } from '../../src/server/queries/public-navigation'
import {
  AuditFailure,
  type AuditEventDraft,
} from '../../src/modules/governance/application/audit-port'
import { assertIntegrationTarget } from './integration-target'
import { loadProjectEnv } from './load-env'

loadProjectEnv()
const target = process.argv.find((arg) => arg.startsWith('--target='))?.slice(9)
assert(target === 'local' || target === 'ci', 'Specify an integration target')
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm-db='))?.slice(13)
const url = assertIntegrationTarget(process.env.INTEGRATION_DATABASE_URL, target, confirmation)
const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 5_000 })
const transaction = createTransactionAdapter(drizzle({ client: pool }), {
  auditPolicies: { 'test.audit': { requireReason: true, changeFields: ['displayName'] } },
})
const eventId = randomUUID()
const competitionId = randomUUID()

try {
  const receipt = await transaction.run(async ({ competition, audit }) => {
    await competition.createCompetition({ id: competitionId, displayName: 'Audit fixture' })
    return audit.append({
      id: eventId,
      actor: { kind: 'system', displayName: 'Synthetic verifier' },
      action: 'test.audit',
      outcome: 'succeeded',
      source: 'job',
      correlationKey: 'audit-verifier',
      reason: 'Synthetic integration proof',
      targets: [{ role: 'primary', type: 'competition', id: competitionId, version: 1n }],
      evidence: {
        kind: 'diff',
        schemaVersion: 1,
        changes: [{ field: 'displayName', before: null, after: 'Audit fixture' }],
      },
    })
  })
  assert.equal(receipt.id, eventId)
  assert(receipt.sequenceNumber > 0n)
  assert(receipt.recordedAt instanceof Date)
  // Database inspection is the explicitly approved integration/privilege seam, not an application read API.
  const stored = await pool.query('SELECT action FROM app.audit_events WHERE id = $1', [eventId])
  assert.equal(stored.rows[0]?.action, 'test.audit')

  const baseEvent = (): AuditEventDraft => ({
    id: randomUUID(),
    actor: { kind: 'system', displayName: 'Synthetic verifier' },
    action: 'test.audit',
    outcome: 'denied',
    source: 'job',
    correlationKey: 'audit-negative',
    reason: 'Synthetic reason',
    targets: [],
  })
  await assert.rejects(
    createTransactionAdapter(drizzle({ client: pool })).run(({ audit }) =>
      audit.append(baseEvent()),
    ),
    (error: unknown) => error instanceof AuditFailure && error.kind === 'invalid',
  )
  const mutableEvent = {
    ...baseEvent(),
    actor: { kind: 'system' as const, displayName: 'Original actor' },
    targets: [
      {
        role: 'primary' as const,
        type: 'competition',
        id: competitionId,
        displayName: 'Original target',
      },
    ],
  }
  await transaction.run(async ({ audit }) => {
    const pending = audit.append(mutableEvent)
    mutableEvent.actor.displayName = 'Changed after invocation'
    mutableEvent.targets[0].displayName = 'Changed after invocation'
    await pending
  })
  const invocationSnapshot = await pool.query(
    'SELECT e.actor_display_snapshot, t.display_snapshot FROM app.audit_events e JOIN app.audit_event_targets t ON t.audit_event_id = e.id WHERE e.id = $1',
    [mutableEvent.id],
  )
  assert.deepEqual(invocationSnapshot.rows[0], {
    actor_display_snapshot: 'Original actor',
    display_snapshot: 'Original target',
  })
  const referenceId = randomUUID()
  await pool.query(
    "INSERT INTO app.supporting_references (id, reference_kind, external_identifier, label) VALUES ($1, 'external_identifier', 'synthetic-case', 'Synthetic reference')",
    [referenceId],
  )
  const referenceTransaction = createTransactionAdapter(drizzle({ client: pool }), {
    auditPolicies: {
      'test.audit': { requireReason: true, requireReference: true, changeFields: [] },
    },
  })
  await assert.rejects(
    referenceTransaction.run(({ audit }) => audit.append(baseEvent())),
    (error: unknown) => error instanceof AuditFailure && error.kind === 'invalid',
  )
  const referenced = { ...baseEvent(), supportingReferenceIds: [referenceId] }
  await referenceTransaction.run(({ audit }) => audit.append(referenced))
  const link = await pool.query(
    "SELECT target_id FROM app.audit_event_targets WHERE audit_event_id = $1 AND target_type = 'supporting_reference'",
    [referenced.id],
  )
  assert.equal(link.rows[0]?.target_id, referenceId)
  await assert.rejects(
    transaction.run(({ audit }) =>
      audit.append({ ...baseEvent(), supportingReferenceIds: [randomUUID()] }),
    ),
    (error: unknown) => error instanceof AuditFailure && error.kind === 'invalid',
  )

  const adminId = randomUUID()
  await pool.query(
    "INSERT INTO app.admin_identities (id, display_name, contact_email, normalized_email) VALUES ($1, 'Synthetic admin', 'audit@example.invalid', 'audit@example.invalid')",
    [adminId],
  )
  const adminEvent = {
    ...baseEvent(),
    actor: {
      kind: 'admin' as const,
      id: adminId,
      displayName: 'Original snapshot',
      email: 'audit@example.invalid',
    },
  }
  await transaction.run(({ audit }) => audit.append(adminEvent))
  await pool.query(
    "UPDATE app.admin_identities SET display_name = 'Changed identity' WHERE id = $1",
    [adminId],
  )
  const snapshot = await pool.query(
    'SELECT actor_admin_identity_id, actor_display_snapshot, actor_email_snapshot FROM app.audit_events WHERE id = $1',
    [adminEvent.id],
  )
  assert.deepEqual(snapshot.rows[0], {
    actor_admin_identity_id: adminId,
    actor_display_snapshot: 'Original snapshot',
    actor_email_snapshot: 'audit@example.invalid',
  })

  const rollbackEvent = {
    ...baseEvent(),
    targets: [{ role: 'primary' as const, type: 'competition', id: competitionId }],
    evidence: {
      kind: 'diff' as const,
      schemaVersion: 1,
      changes: [{ field: 'displayName', before: 'old', after: 'new' }],
    },
  }
  const domainError = new Error('Synthetic domain rejection')
  await assert.rejects(
    transaction.run(async ({ audit }) => {
      await audit.append(rollbackEvent)
      throw domainError
    }),
    (error) => error === domainError,
  )
  for (const [table, key] of [
    ['audit_events', 'id'],
    ['audit_event_targets', 'audit_event_id'],
    ['audit_event_changes', 'audit_event_id'],
  ]) {
    assert.equal(
      (await pool.query(`SELECT id FROM app.${table} WHERE ${key} = $1`, [rollbackEvent.id]))
        .rowCount,
      0,
    )
  }
  const revisionEvent = {
    ...baseEvent(),
    evidence: {
      kind: 'revision' as const,
      schemaVersion: 1,
      type: 'synthetic_revision',
      id: randomUUID(),
    },
  }
  await transaction.run(({ audit }) => audit.append(revisionEvent))
  const revision = await pool.query(
    'SELECT revision_id, redacted_diff FROM app.audit_event_changes WHERE audit_event_id = $1',
    [revisionEvent.id],
  )
  assert.equal(revision.rows[0]?.revision_id, revisionEvent.evidence.id)
  assert.equal(revision.rows[0]?.redacted_diff, null)
  await assert.rejects(
    transaction.run(({ audit }) => audit.append(revisionEvent)),
    (error: unknown) => error instanceof AuditFailure && error.kind === 'conflict',
  )
  const original = await pool.query(
    'SELECT count(*)::int AS count FROM app.audit_event_changes WHERE audit_event_id = $1',
    [revisionEvent.id],
  )
  assert.equal(original.rows[0]?.count, 1, 'Duplicate Event ID changed original evidence')
  const correlated = await transaction.run(({ audit }) => audit.append(baseEvent()))
  assert.notEqual(correlated.id, revisionEvent.id, 'Correlation is not an event deduplication key')
  const swallowedCompetitionId = randomUUID()
  await assert.rejects(
    transaction.run(async ({ competition, audit }) => {
      await competition.createCompetition({
        id: swallowedCompetitionId,
        displayName: 'Must not commit',
      })
      await audit.append({ ...baseEvent(), action: 'unregistered.action' }).catch(() => undefined)
    }),
    (error: unknown) => error instanceof AuditFailure && error.kind === 'invalid',
  )
  assert.equal(
    (await pool.query('SELECT id FROM app.competitions WHERE id = $1', [swallowedCompetitionId]))
      .rowCount,
    0,
  )
  for (const invalid of [
    { ...baseEvent(), action: 'unregistered.action' },
    { ...baseEvent(), reason: '   ' },
    {
      ...baseEvent(),
      evidence: {
        kind: 'diff',
        schemaVersion: 1,
        changes: [{ field: 'password', before: null, after: 'synthetic-secret' }],
      },
    },
    { ...baseEvent(), providerPayload: { token: 'synthetic-secret' } },
    { ...baseEvent(), actor: { kind: 'system', displayName: 'Synthetic', id: randomUUID() } },
    {
      ...baseEvent(),
      targets: [{ role: 'primary', type: 'competition', id: competitionId, version: 0n }],
    },
    {
      ...baseEvent(),
      evidence: {
        kind: 'diff',
        schemaVersion: 1,
        changes: [{ field: 'displayName', before: null, after: { token: 'synthetic-secret' } }],
      },
    },
  ]) {
    await assert.rejects(
      transaction.run(({ audit }) => audit.append(invalid as AuditEventDraft)),
      (error: unknown) => error instanceof AuditFailure && error.kind === 'invalid',
    )
    const absent = await pool.query('SELECT id FROM app.audit_events WHERE id = $1', [invalid.id])
    assert.equal(absent.rowCount, 0, 'Invalid audit evidence was persisted')
  }

  const runtimeClient = await pool.connect()
  try {
    await runtimeClient.query('SET ROLE app_runtime')
    const role = await runtimeClient.query(
      'SELECT current_user AS name, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser',
    )
    assert.equal(role.rows[0]?.name, 'app_runtime')
    assert.equal(role.rows[0]?.superuser, false)
    const runtime = createTransactionAdapter(drizzle({ client: runtimeClient }), {
      auditPolicies: { 'test.audit': { requireReason: true, changeFields: ['displayName'] } },
    })
    const runtimeEvent = { ...rollbackEvent, id: randomUUID(), outcome: 'succeeded' as const }
    await runtime.run(({ audit }) => audit.append(runtimeEvent))
    for (const table of ['audit_events', 'audit_event_targets', 'audit_event_changes']) {
      for (const statement of [
        `UPDATE app.${table} SET id = id`,
        `DELETE FROM app.${table}`,
        `TRUNCATE app.${table}`,
      ]) {
        await assert.rejects(
          runtimeClient.query(statement),
          (error: unknown) => (error as { code?: string }).code === '42501',
        )
      }
    }
    // Failure injection is confined to this guarded disposable database, and the existing grant is restored.
    const deniedEventId = randomUUID()
    const deniedCompetitionId = randomUUID()
    await pool.query('REVOKE INSERT ON app.audit_event_targets FROM app_runtime')
    try {
      await assert.rejects(
        runtime.run(async ({ competition, audit }) => {
          await competition.createCompetition({
            id: deniedCompetitionId,
            displayName: 'Must roll back',
          })
          await audit.append({
            ...baseEvent(),
            id: deniedEventId,
            targets: [{ role: 'primary', type: 'competition', id: deniedCompetitionId }],
          })
        }),
        (error: unknown) => error instanceof AuditFailure && error.kind === 'unavailable',
      )
    } finally {
      await pool.query('GRANT INSERT ON app.audit_event_targets TO app_runtime')
    }
    for (const [table, id] of [
      ['audit_events', deniedEventId],
      ['competitions', deniedCompetitionId],
    ]) {
      const absent = await pool.query(`SELECT id FROM app.${table} WHERE id = $1`, [id])
      assert.equal(absent.rowCount, 0, 'Audit failure retained a partial mutation')
    }
    const failureEvent = {
      ...baseEvent(),
      outcome: 'failed' as const,
      reason: 'Audit unavailable; domain rolled back',
    }
    await runtime.run(({ audit }) => audit.append(failureEvent))
    const failure = await pool.query('SELECT outcome FROM app.audit_events WHERE id = $1', [
      failureEvent.id,
    ])
    assert.equal(
      failure.rows[0]?.outcome,
      'failed',
      'Separate failure audit did not commit after rollback',
    )
    await pool.query('REVOKE INSERT ON app.audit_events FROM app_runtime')
    try {
      await assert.rejects(
        runtime.run(({ audit }) => audit.append(baseEvent())),
        (error: unknown) =>
          error instanceof AuditFailure &&
          error.kind === 'unavailable' &&
          error.message === 'Audit unavailable' &&
          error.cause === undefined,
      )
      const navigation = createPublicNavigationQueries(drizzle({ client: runtimeClient }))
      assert(
        Array.isArray(await navigation.listCompetitions()),
        'Public reads depend on Audit availability',
      )
    } finally {
      await pool.query('GRANT INSERT ON app.audit_events TO app_runtime')
    }
  } finally {
    await runtimeClient.query('RESET ROLE')
    runtimeClient.release()
  }
  console.info('Audit append and domain commit verification passed')
} finally {
  await pool.end()
}
