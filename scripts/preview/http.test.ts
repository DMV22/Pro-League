import { expect, it } from 'vitest'
import { createJsonClient } from './http'

it('retries temporary read failures without exposing provider credentials or response bodies', async () => {
  let attempt = 0
  const client = createJsonClient('https://example.test', 'private-token', {
    fetch: async () =>
      ++attempt === 1
        ? new Response('postgresql://private-password', { status: 503 })
        : Response.json({ ready: true }),
    pause: async () => undefined,
  })
  expect(await client.get('/target')).toEqual({ ready: true })
})

it('does not blindly retry branch creation or expose a failing provider body', async () => {
  let requests = 0
  const client = createJsonClient('https://example.test', 'private-token', {
    fetch: async () => {
      requests++
      return new Response('postgresql://owner:private-token@private-host/database', { status: 503 })
    },
  })
  await expect(client.post('/branches', { name: 'pr-120' })).rejects.toThrow(
    'Provider request failed (HTTP 503)',
  )
  expect(requests).toBe(1)
})
