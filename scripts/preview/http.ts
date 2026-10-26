export class ProviderError extends Error {
  constructor(readonly status: number) {
    super(`Provider request failed (HTTP ${status})`)
  }
}

type Dependencies = { fetch: typeof fetch; pause: (ms: number) => Promise<void> }

export function createJsonClient(
  origin: string,
  token: string,
  dependencies: Partial<Dependencies> = {},
) {
  const request = dependencies.fetch ?? fetch
  const pause = dependencies.pause ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || /[\r\n]/.test(path))
      throw new Error('Invalid provider path')
    const attempts = method === 'GET' || method === 'PUT' || method === 'DELETE' ? 3 : 1
    for (let attempt = 0; attempt < attempts; attempt++) {
      let response: Response
      try {
        response = await request(`${origin}${path}`, {
          method,
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch {
        if (attempt + 1 < attempts) {
          await pause(1000 * 2 ** attempt)
          continue
        }
        throw new ProviderError(0)
      }
      if (!response.ok) {
        await response.body?.cancel()
        const retryable =
          [429, 502, 503, 504].includes(response.status) ||
          (method === 'GET' && response.status === 500)
        if (retryable && attempt + 1 < attempts) {
          await pause(1000 * 2 ** attempt)
          continue
        }
        throw new ProviderError(response.status)
      }
      if (response.status === 204) return undefined as T
      const reader = response.body?.getReader()
      if (!reader) return undefined as T
      const parts: Uint8Array[] = []
      let size = 0
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.length
        if (size > 8 * 1024 * 1024) {
          await reader.cancel()
          throw new Error('Provider response too large')
        }
        parts.push(value)
      }
      try {
        return JSON.parse(Buffer.concat(parts).toString('utf8')) as T
      } catch {
        throw new Error('Invalid provider response')
      }
    }
    throw new ProviderError(0)
  }
  return {
    get: <T>(path: string) => send<T>('GET', path),
    post: <T>(path: string, body: unknown) => send<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => send<T>('PUT', path, body),
    patch: <T>(path: string, body: unknown) => send<T>('PATCH', path, body),
    delete: (path: string) => send<void>('DELETE', path),
  }
}

export type JsonClient = ReturnType<typeof createJsonClient>
export const absent = (error: unknown) => error instanceof ProviderError && error.status === 404
