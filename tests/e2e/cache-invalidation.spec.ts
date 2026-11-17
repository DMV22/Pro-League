import { expect, test } from '@playwright/test'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { createTransactionAdapter } from '../../src/server/db/transaction'
import { createOutboxDelivery } from '../../src/modules/operations/infrastructure/outbox-delivery'
import { createCacheInvalidationDelivery } from '../../src/modules/operations/infrastructure/cache-invalidation-repository'
import { createCacheInvalidationHandler } from '../../src/modules/operations/application/cache-invalidation-handler'
import { dispatchOutboxBatch } from '../../src/modules/operations/application/dispatch-outbox'
import {
  CACHE_INVALIDATION_TYPE,
  cacheInvalidationIntent,
  cacheInvalidationPolicy,
} from '../../src/modules/operations/application/cache-invalidation'

test.skip(
  !process.env.CACHE_INVALIDATION_BROWSER_FIXTURE,
  'Requires a dedicated disposable cache database',
)
test.describe.configure({ mode: 'serial' })
let fixtures: pg.Client
let child: ChildProcess | undefined
let baseURL: string
let logs = ''
const key = randomBytes(32).toString('hex')
const password = randomBytes(32).toString('hex')
const suffix = randomBytes(8).toString('hex')
const runtimeRole = `cache_fixture_runtime_${suffix}`
const workerRole = `cache_fixture_worker_${suffix}`
const competitionId = randomUUID()
const slugId = randomUUID()
const intentIds: string[] = []
const original = `Початковий кеш ${suffix}`
const updated = `Оновлений кеш ${suffix}`

test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!)
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !['proleague_public_cache_local', 'proleague_public_cache_ci'].includes(
      url.pathname.slice(1),
    ) ||
    url.search ||
    url.hash
  )
    throw new Error('Use only an isolated loopback cache fixture database')
  fixtures = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 })
  await fixtures.connect()
  // Names/passwords are locally generated hexadecimal, never caller-supplied SQL.
  for (const [name, group] of [
    [runtimeRole, 'app_runtime'],
    [workerRole, 'app_worker'],
  ]) {
    await fixtures.query(`CREATE ROLE "${name}" LOGIN PASSWORD '${password}'`)
    await fixtures.query(`GRANT ${group} TO "${name}"`)
  }
  await fixtures.query(
    "insert into app.competitions(id,display_name,visibility) values($1,$2,'public')",
    [competitionId, original],
  )
  await fixtures.query(
    'insert into app.competition_slugs(id,competition_id,display_slug,normalized_slug,valid_from_at) values($1,$2,$3,$3,now())',
    [slugId, competitionId, `cache-${suffix}`],
  )
  await fixtures.query('update app.competitions set current_slug_id=$2 where id=$1', [
    competitionId,
    slugId,
  ])
  const runtimeURL = new URL(url)
  runtimeURL.username = runtimeRole
  runtimeURL.password = password
  const workerURL = new URL(runtimeURL)
  workerURL.username = workerRole
  const reservation = createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const address = reservation.address()
  if (!address || typeof address === 'string') throw new Error('No test port')
  baseURL = `http://127.0.0.1:${address.port}`
  await new Promise<void>((resolve, reject) =>
    reservation.close((e) => (e ? reject(e) : resolve())),
  )
  child = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(address.port),
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: runtimeURL.toString(),
        OUTBOX_DATABASE_URL: workerURL.toString(),
        CACHE_INVALIDATION_KEY: key,
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  for (const stream of [child.stdout, child.stderr])
    stream?.on('data', (c) => {
      logs = (logs + String(c)).slice(-6000)
    })
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(baseURL)).ok
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true)
})

test.afterAll(async () => {
  if (child && child.exitCode === null) {
    const exit = once(child, 'exit')
    child.kill()
    await exit
  }
  if (fixtures) {
    try {
      await fixtures.query('delete from app.outbox_messages where id=any($1::uuid[])', [intentIds])
      await fixtures.query('delete from app.cache_invalidation_intents where id=any($1::uuid[])', [
        intentIds,
      ])
      // Slug history is immutable, including synthetic fixtures. Hide only our root.
      await fixtures.query("update app.competitions set visibility='private' where id=$1", [
        competitionId,
      ])
      for (const name of [runtimeRole, workerRole]) {
        await fixtures.query(`DROP ROLE IF EXISTS "${name}"`)
      }
    } finally {
      await fixtures.end()
    }
  }
})
test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus) console.error(logs)
})

async function enqueue() {
  const source = await fixtures.query<{ revision: string }>(
    "select revision::text from app.public_projection_revisions where projection_key='portal'",
  )
  const id = randomUUID()
  intentIds.push(id)
  const db = drizzle({ client: fixtures })
  await createTransactionAdapter(db, {
    outboxPolicies: { [CACHE_INVALIDATION_TYPE]: cacheInvalidationPolicy },
  }).run((r) =>
    r.outbox.enqueue(
      cacheInvalidationIntent({
        id,
        target: { kind: 'portal' },
        revision: BigInt(source.rows[0].revision),
        correlationKey: 'cache-browser',
        causationKey: 'synthetic-fixture',
      }),
    ),
  )
  return id
}

test('confirmed generations refresh Next reads even without tag cleanup; machine dispatch stays protected', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await page.goto(baseURL)
  await expect(page.getByText(original, { exact: true })).toBeVisible()
  // Freeze the source clock for ONE synthetic update to isolate logical invalidation
  // from the independent source-revision cache key. Never used by application code.
  await fixtures.query('BEGIN')
  try {
    await fixtures.query("SET LOCAL session_replication_role = 'replica'")
    await fixtures.query('update app.competitions set display_name=$2 where id=$1', [
      competitionId,
      updated,
    ])
    await fixtures.query('COMMIT')
  } catch (e) {
    await fixtures.query('ROLLBACK')
    throw e
  }
  await page.reload()
  await expect(page.getByText(original, { exact: true })).toBeVisible()
  await enqueue()
  // Dispatch as the actual restricted worker, deliberately without any Next tag cleanup.
  // Future Next requests must use the durable generation rather than the warmed entry.
  await fixtures.query('SET ROLE app_worker')
  try {
    const database = drizzle({ client: fixtures })
    const summary = await dispatchOutboxBatch(
      createOutboxDelivery(database, { messageTypes: [CACHE_INVALIDATION_TYPE] }),
      {
        [CACHE_INVALIDATION_TYPE]: createCacheInvalidationHandler(
          createCacheInvalidationDelivery(database),
          async () => {},
        ),
      },
      { maxMessages: 1 },
    )
    expect(summary.succeeded).toBe(1)
  } finally {
    await fixtures.query('RESET ROLE')
  }
  await page.reload()
  await expect(page.getByText(updated, { exact: true })).toBeVisible()
  await fixtures.query('update app.competitions set updated_at=clock_timestamp() where id=$1', [
    competitionId,
  ])
  await enqueue()
  const endpoint = baseURL + '/api/operations/cache-invalidation'
  expect((await request.post(endpoint)).status()).toBe(401)
  const headers = { Authorization: `Bearer ${key}` }
  expect((await request.post(endpoint, { headers, data: 'submitted-tags' })).status()).toBe(400)
  expect((await request.post(endpoint + '?tag=public:v1:portal', { headers })).status()).toBe(400)
  const response = await request.post(endpoint, { headers })
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(await response.json()).toMatchObject({ status: 'completed', summary: { succeeded: 1 } })
  await expect
    .poll(
      async () => {
        await page.reload()
        return page.getByText(updated, { exact: true }).count()
      },
      { timeout: 10_000 },
    )
    .toBe(1)
  expect((await request.post(endpoint, { headers })).status()).toBe(200)

  await fixtures.query('update app.competitions set updated_at=clock_timestamp() where id=$1', [
    competitionId,
  ])
  const pendingId = await enqueue()
  await fixtures.query(
    "update app.cache_invalidation_intents set created_at=clock_timestamp()-interval '61 seconds' where id=$1",
    [pendingId],
  )
  await page.reload()
  await expect(
    page.getByRole('status').filter({ hasText: 'Оновлення кешу затримується' }),
  ).toBeVisible()
  await expect(page.getByText(updated, { exact: true })).toBeVisible()
})
