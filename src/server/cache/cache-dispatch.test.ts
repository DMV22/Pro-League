import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('pg', () => ({
  default: {
    Pool: class {
      constructor() {
        throw new Error('Synthetic unavailable database')
      }
    },
  },
}))
vi.mock('next/cache', () => ({ revalidateTag: () => {} }))
import { POST } from '../../app/api/operations/cache-invalidation/route'

afterEach(() => vi.unstubAllEnvs())
const key = 'a'.repeat(64)
const request = (authorization?: string, body?: string) =>
  new Request('http://localhost/api/operations/cache-invalidation', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
    body,
  })

it('is disabled without a valid configured key, before acquiring a database', async () => {
  vi.stubEnv('CACHE_INVALIDATION_KEY', '')
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toContain('no-store')
})

it('rejects an unauthorized caller even when the database is unavailable', async () => {
  vi.stubEnv('CACHE_INVALIDATION_KEY', key)
  expect((await POST(request())).status).toBe(401)
  expect((await POST(request('Bearer wrong'))).status).toBe(401)
})

it('never accepts submitted tags or turns unavailable worker setup into success', async () => {
  vi.stubEnv('CACHE_INVALIDATION_KEY', key)
  vi.stubEnv('OUTBOX_DATABASE_URL', '')
  expect((await POST(request(`Bearer ${key}`, 'tag=anything'))).status).toBe(400)
  const response = await POST(request(`Bearer ${key}`))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ status: 'unavailable' })
  const emptyStream = new Request('http://localhost/api/operations/cache-invalidation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
    duplex: 'half',
  } as RequestInit)
  expect((await POST(emptyStream)).status).toBe(503)
})
