import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'

type Input = { idempotencyKey: string; payload: { id: string } }
type Cleanup = () => Promise<unknown> | void

// Test-only ownership: every acquired resource registers cleanup before more work starts.
class Resources {
  private readonly cleanups: Cleanup[] = []

  constructor(private readonly pool: Pool) {}

  async close(): Promise<unknown[]> {
    const errors: unknown[] = []
    for (const cleanup of this.cleanups.reverse()) {
      try {
        await cleanup()
      } catch (error) {
        errors.push(error)
      }
    }
    this.cleanups.length = 0
    return errors
  }

  async client(
    options: { runtime?: boolean; notice?: (notice: { message?: string }) => void } = {},
  ) {
    const client = await this.pool.connect()
    this.cleanups.push(() => client.release(true))
    if (options.notice) {
      const listener = options.notice
      client.on('notice', listener)
      this.cleanups.push(() => {
        client.off('notice', listener)
      })
    }
    if (options.runtime) await client.query('SET ROLE app_runtime')
    // Destroy, rather than return, dedicated sessions: no role/transaction state can leak.
    return client
  }

  async suspendGrant(grantId: string) {
    this.cleanups.push(() =>
      this.pool.query("UPDATE app.admin_access_grants SET state = 'active' WHERE id = $1", [
        grantId,
      ]),
    )
    await this.pool.query("UPDATE app.admin_access_grants SET state = 'suspended' WHERE id = $1", [
      grantId,
    ])
  }

  async revokeWhile<T>(grantId: string, start: () => Promise<T>): Promise<T> {
    const holder = await this.client()
    const observer = await this.client()
    const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const work: { pending?: Promise<{ value: T } | { error: unknown }> } = {}
    this.cleanups.push(async () => {
      await this.pool.query(
        "UPDATE app.admin_access_grants SET state = 'active', ended_at = null WHERE id = $1",
        [grantId],
      )
    })
    this.cleanups.push(async () => {
      if (work.pending) await work.pending
    })
    // Reverse disposal releases the lock, drains pending work, then restores the Grant.
    this.cleanups.push(() => holder.query('ROLLBACK'))
    await holder.query('BEGIN')
    await holder.query(
      "UPDATE app.admin_access_grants SET state = 'revoked', ended_at = now() WHERE id = $1",
      [grantId],
    )
    work.pending = start().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    )
    let waiting = false
    for (let n = 0; n < 100; n++) {
      const locked = await observer.query(
        'SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND $1 = ANY(pg_blocking_pids(pid))',
        [pid],
      )
      if (locked.rowCount) {
        waiting = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert(waiting, 'Protected command did not wait on the current Grant lock')
    await holder.query('COMMIT')
    const result = await work.pending
    if ('error' in result) throw result.error
    return result.value
  }

  private async fault(
    table: 'outbox_messages' | 'command_executions',
    event: 'INSERT' | 'UPDATE',
    body: string,
    sequence?: string,
  ) {
    const suffix = randomUUID().replaceAll('-', '')
    const fn = `executor_fixture_fn_${suffix}`
    const trigger = `executor_fixture_tr_${suffix}`
    if (sequence) {
      await this.pool.query(`CREATE SEQUENCE app.${sequence}`)
      this.cleanups.push(() => this.pool.query(`DROP SEQUENCE IF EXISTS app.${sequence}`))
    }
    await this.pool.query(
      `CREATE FUNCTION app.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} RETURN NEW; END $$`,
    )
    this.cleanups.push(() => this.pool.query(`DROP FUNCTION IF EXISTS app.${fn}()`))
    await this.pool.query(
      `CREATE TRIGGER ${trigger} BEFORE ${event} ON app.${table} FOR EACH ROW EXECUTE FUNCTION app.${fn}()`,
    )
    this.cleanups.push(() => this.pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON app.${table}`))
  }

  async retryFault(inputs: {
    retry: Input
    exhausted: Input
    noRetry: Input
    lostSession: Input
    switchedActor: Input
  }) {
    const sequence = `executor_fixture_seq_${randomUUID().replaceAll('-', '')}`
    for (const input of Object.values(inputs)) assert.match(input.payload.id, /^[0-9a-f-]{36}$/)
    await this.fault(
      'outbox_messages',
      'INSERT',
      `
      IF NEW.aggregate_id = '${inputs.retry.payload.id}' THEN RAISE NOTICE 'synthetic-intent:%', NEW.id; END IF;
      IF NEW.aggregate_id = '${inputs.retry.payload.id}' AND nextval('app.${sequence}') = 1 THEN
        RAISE EXCEPTION 'synthetic serialization failure' USING ERRCODE = '40001';
      ELSIF NEW.aggregate_id = '${inputs.exhausted.payload.id}' THEN
        PERFORM nextval('app.${sequence}'); RAISE EXCEPTION 'synthetic deadlock' USING ERRCODE = '40P01';
      ELSIF NEW.aggregate_id = '${inputs.noRetry.payload.id}' THEN
        PERFORM nextval('app.${sequence}'); RAISE EXCEPTION 'synthetic constraint' USING ERRCODE = '23514';
      ELSIF NEW.aggregate_id IN ('${inputs.lostSession.payload.id}', '${inputs.switchedActor.payload.id}') THEN
        RAISE EXCEPTION 'synthetic retry with renewed authentication' USING ERRCODE = '40001';
      END IF;`,
      sequence,
    )
  }

  async outcomeFault(input: Input) {
    assert.match(input.idempotencyKey, /^[0-9a-f-]{36}$/)
    await this.fault(
      'command_executions',
      'UPDATE',
      `
      IF NEW.idempotency_key = '${input.idempotencyKey}' THEN
        RAISE EXCEPTION 'synthetic outcome storage failure' USING ERRCODE = '23514';
      END IF;`,
    )
  }
}

export async function executorScenario<T>(
  pool: Pool,
  name: string,
  run: (resources: Resources) => Promise<T>,
): Promise<T> {
  const resources = new Resources(pool)
  let result: T | undefined
  const errors: unknown[] = []
  try {
    result = await run(resources)
  } catch (error) {
    errors.push(error)
  }
  errors.push(...(await resources.close()))
  if (errors.length)
    throw new AggregateError(errors, `Executor scenario failed: ${name}`, { cause: errors[0] })
  console.info(`Executor scenario passed: ${name}`)
  return result as T
}

export async function withExecutorFixtures(
  pool: Pool,
  run: (fixtures: {
    request: (id?: string) => Input
    actor: () => Promise<{ identityId: string; grantId: string; subject: string }>
  }) => Promise<void>,
): Promise<void> {
  const entityIds: string[] = []
  const errors: unknown[] = []
  try {
    await run({
      request(id = randomUUID()) {
        entityIds.push(id)
        return { idempotencyKey: randomUUID(), payload: { id } }
      },
      async actor() {
        const identityId = randomUUID(),
          grantId = randomUUID(),
          subject = `synthetic-${randomUUID()}`
        await pool.query(
          'INSERT INTO app.admin_identities (id, display_name, contact_email, normalized_email) VALUES ($1, $2, $3, $3)',
          [identityId, 'Synthetic executor Admin', `${identityId}@example.invalid`],
        )
        await pool.query(
          'INSERT INTO app.admin_external_identities (id, admin_identity_id, provider_user_id, last_synchronized_at) VALUES ($1, $2, $3, now())',
          [randomUUID(), identityId, subject],
        )
        await pool.query(
          "INSERT INTO app.admin_access_grants (id, admin_identity_id, source, state, effective_at) VALUES ($1, $2, 'bootstrap', 'active', now())",
          [grantId, identityId],
        )
        return { identityId, grantId, subject }
      },
    })
  } catch (error) {
    errors.push(error)
  } finally {
    // Retain immutable Audit History and referenced identities. Clean only owned mutable rows.
    for (const id of entityIds) {
      for (const table of ['outbox_messages', 'competitions']) {
        try {
          const key = table === 'outbox_messages' ? 'aggregate_id' : 'id'
          await pool.query(`DELETE FROM app.${table} WHERE ${key} = $1`, [id])
        } catch (error) {
          errors.push(error)
        }
      }
    }
    try {
      await pool.end()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length)
    throw new AggregateError(errors, 'Executor fixture cleanup failed', { cause: errors[0] })
}
