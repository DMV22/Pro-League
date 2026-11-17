import { timingSafeEqual } from 'node:crypto'
import { dispatchCacheInvalidation } from '@/server/cache/dispatch-cache-invalidation'

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }

/** Machine-only scheduler entry. No Clerk identity, submitted tags, IDs, limits or lease tokens. */
export async function POST(request: Request) {
  const key = process.env.CACHE_INVALIDATION_KEY
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    return Response.json({ status: 'unavailable' }, { status: 503, headers })
  const received = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${key}`
  if (
    Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  )
    return Response.json({ status: 'unauthorized' }, { status: 401, headers })
  // Node may expose an empty POST as a non-null stream. Read at most one chunk,
  // with a deadline, and reject any payload without buffering caller-controlled input.
  if (new URL(request.url).search || (await hasPayload(request)))
    return Response.json({ status: 'invalid' }, { status: 400, headers })
  try {
    const summary = await dispatchCacheInvalidation()
    return Response.json({ status: 'completed', summary }, { headers })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers })
  }
}

async function hasPayload(request: Request): Promise<boolean> {
  if (!request.body) return false
  const reader = request.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      reader.read().then((chunk) => !chunk.done),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), 1000)
      }),
    ])
  } catch {
    return true
  } finally {
    clearTimeout(timer)
    void reader.cancel().catch(() => {})
  }
}
