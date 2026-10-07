import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

import { drizzle } from 'drizzle-orm/node-postgres'
import pg, { type PoolClient } from 'pg'

import { createTransactionAdapter } from '../../src/server/db/transaction'
import { assertIntegrationTarget, type IntegrationTarget } from './integration-target'
import { loadProjectEnv } from './load-env'

loadProjectEnv()

const targetArg = process.argv.find((arg) => arg.startsWith('--target='))?.slice('--target='.length)
if (targetArg !== 'local' && targetArg !== 'ci') {
  throw new Error('Specify --target=local or --target=ci')
}
const target: IntegrationTarget = targetArg
const confirmation = process.argv
  .find((arg) => arg.startsWith('--confirm-db='))
  ?.slice('--confirm-db='.length)
const url = assertIntegrationTarget(process.env.INTEGRATION_DATABASE_URL, target, confirmation)

const pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 5_000 })
const jobId = '01990000-0076-7000-8000-000000000001'
const outboxId = '01990000-0076-7000-8000-000000000002'
const lockCompetitionId = '01990000-0076-7000-8000-000000000005'
const lockSeasonId = '01990000-0076-7000-8000-000000000006'

async function sqlState(client: PoolClient, statement: string, expected: string): Promise<void> {
  await client.query('SAVEPOINT expected_error')
  let actual: string | undefined
  try {
    await client.query(statement)
  } catch (error) {
    actual = (error as { code?: string }).code
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_error')
    await client.query('RELEASE SAVEPOINT expected_error')
  }
  assert.equal(actual, expected, `${statement} must fail with ${expected}`)
}

function runExisting(script: string): void {
  const child = spawnSync(
    process.execPath,
    ['--conditions=react-server', '--import', 'tsx', script],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url },
      stdio: 'inherit',
    },
  )
  if (child.error) throw child.error
  assert.equal(child.status, 0, `${script} failed`)
}

async function verifyRoleAndRollback(): Promise<void> {
  const client = await pool.connect()
  const competitionId = '01990000-0076-7000-8000-000000000003'
  const auditId = '01990000-0076-7000-8000-000000000004'
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE app_public_reader')
    await sqlState(client, 'SELECT id FROM app.competitions LIMIT 1', '42501')
    await sqlState(client, 'SELECT id FROM app.player_private_details LIMIT 1', '42501')
    await client.query('ROLLBACK')

    await client.query('BEGIN')
    await client.query('INSERT INTO app.competitions (id, display_name) VALUES ($1, $2)', [
      competitionId,
      'Rollback boundary',
    ])
    await client.query(
      `INSERT INTO app.audit_events
       (id, actor_kind, actor_display_snapshot, action, outcome, source)
       VALUES ($1, 'system', 'Integration test', 'competition.created', 'succeeded', 'test')`,
      [auditId],
    )
    await client.query(
      `INSERT INTO app.outbox_messages
       (id, message_type, schema_version, payload, aggregate_type, aggregate_id,
        aggregate_version, available_at)
       VALUES ($1, 'competition.created', 1, '{}'::jsonb, 'competition', $2, 1, now())`,
      [outboxId, competitionId],
    )
    await client.query('ROLLBACK')
    for (const [table, id] of [
      ['competitions', competitionId],
      ['audit_events', auditId],
      ['outbox_messages', outboxId],
    ]) {
      const result = await client.query(`SELECT id FROM app.${table} WHERE id = $1`, [id])
      assert.equal(result.rowCount, 0, `${table} survived rejected decision`)
    }
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    client.release()
  }
}

async function claim(
  client: PoolClient,
  table: 'scheduled_jobs' | 'outbox_messages',
  id: string,
): Promise<string[]> {
  const orderColumn = table === 'scheduled_jobs' ? 'due_at' : 'available_at'
  const result = await client.query<{ id: string }>(
    `WITH candidate AS (
       SELECT id FROM app.${table}
       WHERE id = $1 AND state = 'pending' AND ${orderColumn} <= now()
       ORDER BY ${orderColumn}, id FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE app.${table} AS queue
     SET state = 'leased', lease_until_at = now() + interval '1 minute',
         attempt_count = attempt_count + 1
     FROM candidate WHERE queue.id = candidate.id RETURNING queue.id`,
    [id],
  )
  return result.rows.map((row) => row.id)
}

async function verifyExclusiveClaim(
  table: 'scheduled_jobs' | 'outbox_messages',
  id: string,
): Promise<void> {
  const first = await pool.connect()
  const second = await pool.connect()
  try {
    await first.query('BEGIN')
    await second.query('BEGIN')
    assert.deepEqual(await claim(first, table, id), [id])
    assert.deepEqual(await claim(second, table, id), [])
    await first.query('COMMIT')
    assert.deepEqual(await claim(second, table, id), [])
    await second.query('COMMIT')
    const row = await pool.query<{ attempt_count: number; state: string }>(
      `SELECT attempt_count, state FROM app.${table} WHERE id = $1`,
      [id],
    )
    assert.deepEqual(row.rows[0], { attempt_count: 1, state: 'leased' })
  } finally {
    await Promise.all([
      first.query('ROLLBACK').catch(() => undefined),
      second.query('ROLLBACK').catch(() => undefined),
    ])
    first.release()
    second.release()
  }
}

async function verifyQueueClaims(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO app.scheduled_jobs
       (id, logical_job_key, job_type, target_type, target_id, due_at)
       VALUES ($1, 'integration-76-job', 'test', 'competition', $2, now() - interval '1 minute')`,
      [jobId, jobId],
    )
    await client.query(
      `INSERT INTO app.outbox_messages
       (id, message_type, schema_version, payload, aggregate_type, aggregate_id,
        aggregate_version, available_at)
       VALUES ($1, 'test', 1, '{}'::jsonb, 'competition', $2, 1,
         now() - interval '1 minute')`,
      [outboxId, jobId],
    )
    await client.query('COMMIT')

    await verifyExclusiveClaim('scheduled_jobs', jobId)
    await verifyExclusiveClaim('outbox_messages', outboxId)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.query('DELETE FROM app.scheduled_jobs WHERE id = $1', [jobId])
    await client.query('DELETE FROM app.outbox_messages WHERE id = $1', [outboxId])
    client.release()
  }
}

async function verifyParentBeforeChildLock(): Promise<void> {
  const parentHolder = await pool.connect()
  const waiter = await pool.connect()
  const observer = await pool.connect()
  let waiting: Promise<unknown> | undefined
  try {
    await observer.query(
      `INSERT INTO app.competitions (id, display_name)
       VALUES ($1, 'Lock order test')`,
      [lockCompetitionId],
    )
    await observer.query(
      `INSERT INTO app.seasons (id, competition_id, name, timezone)
       VALUES ($1, $2, 'Lock order season', 'Europe/Kyiv')`,
      [lockSeasonId, lockCompetitionId],
    )
    await parentHolder.query('BEGIN')
    await parentHolder.query('SELECT id FROM app.seasons WHERE id = $1 FOR UPDATE', [lockSeasonId])

    const pid = (await waiter.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid
    assert(pid)
    const adapter = createTransactionAdapter(drizzle({ client: waiter }))
    waiting = adapter.run(async ({ competition }) => {
      await competition.lockCompetitionAndSeason({
        competitionId: lockCompetitionId,
        seasonId: lockSeasonId,
      })
    })

    let blockedOnChild = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = await observer.query<{ wait_event_type: string | null }>(
        'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1',
        [pid],
      )
      if (state.rows[0]?.wait_event_type === 'Lock') {
        blockedOnChild = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    assert(blockedOnChild, 'Repository lock did not wait on the held Season row')

    await observer.query('BEGIN')
    await sqlState(
      observer,
      `SELECT id FROM app.competitions WHERE id = '${lockCompetitionId}' FOR UPDATE NOWAIT`,
      '55P03',
    )
    await observer.query('ROLLBACK')
    await parentHolder.query('COMMIT')
    await waiting
  } finally {
    await parentHolder.query('ROLLBACK').catch(() => undefined)
    await observer.query('ROLLBACK').catch(() => undefined)
    if (waiting) await Promise.allSettled([waiting])
    await observer.query('DELETE FROM app.seasons WHERE id = $1', [lockSeasonId])
    await observer.query('DELETE FROM app.competitions WHERE id = $1', [lockCompetitionId])
    parentHolder.release()
    waiter.release()
    observer.release()
  }
}

try {
  const version = await pool.query<{ server_version_num: string }>('SHOW server_version_num')
  assert.equal(Math.floor(Number(version.rows[0]?.server_version_num) / 10_000), 18)
  const ledger = await pool.query<{ count: string }>(
    'SELECT count(*) FROM app.__drizzle_migrations',
  )
  assert.equal(Number(ledger.rows[0]?.count), 2, 'Apply both reviewed migrations first')
  const data = await pool.query<{ total: string }>(
    `SELECT (SELECT count(*) FROM app.competitions) +
            (SELECT count(*) FROM app.scheduled_jobs) +
            (SELECT count(*) FROM app.outbox_messages) AS total`,
  )
  assert.equal(Number(data.rows[0]?.total), 0, 'Integration database must be disposable and empty')

  runExisting('scripts/db/verify-initial-migration.ts')
  runExisting('scripts/db/verify-repositories.ts')
  runExisting('scripts/db/verify-public-queries.ts')
  runExisting('scripts/db/verify-public-navigation.ts')
  await verifyRoleAndRollback()
  await verifyQueueClaims()
  await verifyParentBeforeChildLock()
  console.info('PostgreSQL 18 integration verification passed')
} finally {
  await pool.end()
}
