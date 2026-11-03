import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { dispatchOutboxBatch } from '../../src/modules/operations/application/dispatch-outbox'
import { resolveDispatchOptions } from '../../src/modules/operations/application/delivery-policy'
import { OutboxFailure } from '../../src/modules/operations/application/outbox-port'
import { createOutboxDelivery } from '../../src/modules/operations/infrastructure/outbox-delivery'
import { runtimeOutboxHandlers } from '../../src/server/outbox-handlers'
import { loadProjectEnv } from '../db/load-env'

loadProjectEnv()

async function main() {
  const args = new Map<string, string>()
  for (const arg of process.argv.slice(2)) {
    const match = /^--(mode|confirm-db|limit|duration-ms)=(.+)$/.exec(arg)
    if (!match || args.has(match[1])) throw new OutboxFailure('invalid')
    args.set(match[1], match[2])
  }
  const mode = args.get('mode') ?? 'inspect'
  if (mode !== 'inspect' && mode !== 'dispatch') throw new OutboxFailure('invalid')
  const value = process.env.OUTBOX_DATABASE_URL
  if (!value) throw new OutboxFailure('invalid')
  const url = new URL(value)
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.pathname.slice(1) ||
    decodeURIComponent(url.pathname.slice(1)) !== args.get('confirm-db')
  )
    throw new OutboxFailure('invalid')
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    url.searchParams.get('sslmode') !== 'verify-full'
  )
    throw new OutboxFailure('invalid')
  // Fail before claim: an empty production registry must not drain a future feature's messages.
  if (mode === 'dispatch' && Object.keys(runtimeOutboxHandlers).length === 0)
    throw new OutboxFailure('invalid')
  const policy = resolveDispatchOptions({
    maxMessages: args.has('limit') ? Number(args.get('limit')) : undefined,
    maxDurationMs: args.has('duration-ms') ? Number(args.get('duration-ms')) : undefined,
  })
  const pool = new pg.Pool({
    connectionString: value,
    max: 1,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    query_timeout: 7_000,
    application_name: 'proleague-outbox-operator',
  })
  let client: pg.PoolClient | undefined
  try {
    client = await pool.connect()
    const role = await client.query<{ elevated: boolean }>(`SELECT rolsuper OR rolcreaterole OR
      has_table_privilege(current_user, 'app.outbox_messages', 'TRUNCATE') AS elevated FROM pg_roles WHERE rolname = current_user`)
    if (role.rows[0]?.elevated !== false) throw new OutboxFailure('invalid')
    const delivery = createOutboxDelivery(drizzle({ client }))
    const result =
      mode === 'inspect'
        ? await delivery.listProblems(policy.maxMessages)
        : await dispatchOutboxBatch(delivery, runtimeOutboxHandlers, policy)
    console.info(
      JSON.stringify(result, (_, item: unknown) =>
        typeof item === 'bigint' ? item.toString() : item,
      ),
    )
  } finally {
    client?.release()
    await pool.end()
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof OutboxFailure ? error.message : 'Outbox operation unavailable')
  process.exitCode = 1
}
