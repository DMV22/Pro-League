import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { createLocalAdminAccess } from '../../src/modules/identity-access/infrastructure/command-access'
import { createProtectedCommandTransaction } from '../../src/server/commands/protected-command'
import {
  executeAdminCommand,
  type AdminCommandDefinition,
} from '../../src/application/commands/execute-admin-command'
import { assertIntegrationTarget } from './integration-target'
import { loadProjectEnv } from './load-env'
import { executorScenario, withExecutorFixtures } from './command-executor-fixtures'

loadProjectEnv()
const target = process.argv.find((arg) => arg.startsWith('--target='))?.slice(9)
assert(target === 'ci' || target === 'local', 'Specify integration target')
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm-db='))?.slice(13)
const url = assertIntegrationTarget(process.env.INTEGRATION_DATABASE_URL, target, confirmation)
const pool = new pg.Pool({
  connectionString: url,
  max: 4,
  connectionTimeoutMillis: 5000,
  statement_timeout: 8000,
})
const database = drizzle({ client: pool })
await withExecutorFixtures(pool, async ({ actor, request }) => {
  const { identityId, grantId, subject } = await actor()
  const session = {
    subject,
    sessionId: `synthetic-${randomUUID()}`,
    startedAt: Date.parse('2026-01-01'),
  }
  const read = createLocalAdminAccess(database)
  await executorScenario(pool, 'local Admin reads require current mapped access', async () => {
    const granted = await read.authorize(session)
    assert.equal(granted?.actor.adminIdentityId, identityId)
    assert.equal(granted?.actor.accessGrantId, grantId)
    assert.equal(await read.authorize({ ...session, subject: 'unmapped' }), null)
    for (const state of ['invited', 'suspended', 'revoked']) {
      await pool.query('UPDATE app.admin_access_grants SET state = $2 WHERE id = $1', [
        grantId,
        state,
      ])
      assert.equal(await read.authorize(session), null, state)
    }
    await pool.query("UPDATE app.admin_access_grants SET state = 'active' WHERE id = $1", [grantId])
    await pool.query("UPDATE app.admin_identities SET lifecycle_state = 'retired' WHERE id = $1", [
      identityId,
    ])
    assert.equal(await read.authorize(session), null)
    await pool.query("UPDATE app.admin_identities SET lifecycle_state = 'active' WHERE id = $1", [
      identityId,
    ])
    await pool.query(
      "UPDATE app.admin_access_grants SET effective_at = now() + interval '1 day' WHERE id = $1",
      [grantId],
    )
    assert.equal(await read.authorize(session), null)
    await pool.query(
      'UPDATE app.admin_access_grants SET effective_at = now(), ended_at = now() WHERE id = $1',
      [grantId],
    )
    assert.equal(await read.authorize(session), null)
    await pool.query('UPDATE app.admin_access_grants SET ended_at = null WHERE id = $1', [grantId])
    assert.equal(await read.authorize({ ...session, startedAt: NaN }), null)
    assert.equal(await read.authorize({ ...session, startedAt: Date.now() + 86400000 }), null)
  })
  await executorScenario(
    pool,
    'restoration requires a new session for read, command and replay',
    async () => {
      const transaction = createProtectedCommandTransaction(database, {
        auditPolicies: { 'test.auth': { requireReason: false, changeFields: [] } },
      })
      const definition: AdminCommandDefinition<{ id: string }> = {
        type: 'test.auth',
        version: 1,
        resultFields: ['id'],
        validate: (payload) => ({ valid: true, value: payload as { id: string } }),
        async run(input, _context, repositories) {
          const row = await repositories.competition.createCompetition({
            id: input.payload.id,
            displayName: 'Synthetic auth acceptance',
          })
          return {
            value: { id: row.id },
            audit: {
              targets: [{ role: 'primary', type: 'competition', id: row.id, version: row.version }],
            },
          }
        },
      }
      const input = request()
      const run = (proof = session) =>
        executeAdminCommand(
          {
            session: {
              async verify() {
                return proof
              },
            },
            transaction,
          },
          definition,
          input,
          { correlationKey: `auth-${randomUUID()}` },
        )
      assert.equal((await run()).status, 'succeeded')
      await pool.query(
        "INSERT INTO app.admin_access_state_transitions (id, grant_id, from_state, to_state, reason, recorded_at) VALUES ($1, $2, 'suspended', 'active', 'Synthetic restoration', clock_timestamp() - interval '1 second')",
        [randomUUID(), grantId],
      )
      assert.equal(
        await read.authorize(session),
        null,
        'Restoring Active must not revive an older session',
      )
      assert.deepEqual(
        await run(),
        { status: 'forbidden', code: 'access_denied' },
        'Even replay needs the restored-session check',
      )
      const newer = {
        ...session,
        sessionId: `synthetic-new-${randomUUID()}`,
        startedAt: Date.now() - 100,
      }
      assert.equal((await read.authorize(newer))?.actor.accessGrantId, grantId)
      assert.deepEqual(await run(newer), { status: 'succeeded', value: { id: input.payload.id } })
      await pool.query(
        'INSERT INTO app.admin_sessions (id, grant_id, provider_session_hash, started_at, last_seen_at, revoked_at) VALUES ($1, $2, $3, now(), now(), now())',
        [randomUUID(), grantId, createHash('sha256').update(newer.sessionId).digest('hex')],
      )
      assert.equal(
        await read.authorize(newer),
        null,
        'A locally revoked session cannot reauthorize',
      )
      assert.deepEqual(await run(newer), { status: 'forbidden', code: 'access_denied' })
    },
  )
})
console.info('Admin access integration verification passed')
