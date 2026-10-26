import { expect, it, vi } from 'vitest'
import { createJsonClient, ProviderError } from './http'

it('recovers a read when GitHub returns HTTP 500 before a valid response', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('upstream unavailable', { status: 500 }))
    .mockResolvedValueOnce(Response.json({ files: ['docs/acceptance.md'] }))
  const pause = vi.fn(async () => undefined)
  const client = createJsonClient('https://api.example.test', 'test-only-token', {
    fetch: request,
    pause,
  })

  await expect(client.get('/files')).resolves.toEqual({ files: ['docs/acceptance.md'] })
  expect(pause.mock.calls).toEqual([[1000]])
})

it('fails closed after three HTTP 500 reads and only two bounded pauses', async () => {
  const request = vi.fn<typeof fetch>(
    async () => new Response('secret upstream body', { status: 500 }),
  )
  const pause = vi.fn(async () => undefined)
  const client = createJsonClient('https://api.example.test', 'test-only-token', {
    fetch: request,
    pause,
  })

  await expect(client.get('/files')).rejects.toMatchObject({ status: 500 })
  expect(request).toHaveBeenCalledTimes(3)
  expect(pause.mock.calls).toEqual([[1000], [2000]])
})

it.each(['post', 'patch', 'put', 'delete'] as const)(
  'does not add HTTP 500 retries to %s mutations',
  async (method) => {
    const request = vi.fn<typeof fetch>(
      async () => new Response('secret upstream body', { status: 500 }),
    )
    const pause = vi.fn(async () => undefined)
    const client = createJsonClient('https://api.example.test', 'test-only-token', {
      fetch: request,
      pause,
    })
    const result =
      method === 'delete' ? client.delete('/resource') : client[method]('/resource', { value: 1 })
    await expect(result).rejects.toBeInstanceOf(ProviderError)
    expect(request).toHaveBeenCalledTimes(1)
    expect(pause).not.toHaveBeenCalled()
  },
)

it.each([401, 403, 404])('does not retry HTTP %s read failures', async (status) => {
  const request = vi.fn<typeof fetch>(async () => new Response('upstream body', { status }))
  const pause = vi.fn(async () => undefined)
  const client = createJsonClient('https://api.example.test', 'test-only-token', {
    fetch: request,
    pause,
  })
  await expect(client.get('/files')).rejects.toMatchObject({ status })
  expect(request).toHaveBeenCalledTimes(1)
  expect(pause).not.toHaveBeenCalled()
})

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
