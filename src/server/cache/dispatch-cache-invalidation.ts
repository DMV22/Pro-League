import 'server-only'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { readDatabaseUrl } from '../db/config'
import { CACHE_INVALIDATION_TYPE } from '../../modules/operations/application/cache-invalidation'
import { createCacheInvalidationHandler } from '../../modules/operations/application/cache-invalidation-handler'
import { createCacheInvalidationDelivery } from '../../modules/operations/infrastructure/cache-invalidation-repository'
import { createOutboxDelivery } from '../../modules/operations/infrastructure/outbox-delivery'
import { dispatchOutboxBatch } from '../../modules/operations/application/dispatch-outbox'
import { invalidatePublicCache } from './invalidate-public-cache'

/** Request-owned worker connection. No pool, claims or effects exist until HTTP authentication passed. */
export async function dispatchCacheInvalidation() {
  const connectionString = readDatabaseUrl('DATABASE_URL', {
    ...process.env,
    DATABASE_URL: process.env.OUTBOX_DATABASE_URL,
  })
  const url = new URL(connectionString)
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    url.searchParams.get('sslmode') !== 'verify-full'
  )
    throw new Error('Worker configuration unavailable')
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    query_timeout: 7000,
    application_name: 'proleague-cache-dispatch',
  })
  try {
    const role = await pool.query<{ allowed: boolean }>(`select
      not (rolsuper or rolcreaterole) and
      not has_table_privilege(current_user, 'app.outbox_messages', 'TRUNCATE') and
      not has_table_privilege(current_user, 'app.cache_invalidation_intents', 'INSERT') and
      has_table_privilege(current_user, 'app.cache_invalidation_intents', 'UPDATE') as allowed
      from pg_roles where rolname=current_user`)
    if (role.rows[0]?.allowed !== true) throw new Error('Worker role unavailable')
    const database = drizzle({ client: pool })
    return await dispatchOutboxBatch(
      createOutboxDelivery(database, { messageTypes: [CACHE_INVALIDATION_TYPE] }),
      {
        [CACHE_INVALIDATION_TYPE]: createCacheInvalidationHandler(
          createCacheInvalidationDelivery(database),
          invalidatePublicCache,
        ),
      },
      { maxMessages: 20, maxDurationMs: 10_000 },
    )
  } finally {
    await pool.end()
  }
}
