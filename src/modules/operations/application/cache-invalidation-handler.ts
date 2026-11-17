import type { OutboxHandler } from './dispatch-outbox'
import type { OutboxIntent } from './outbox-port'
import {
  cacheInvalidationPolicy,
  readCacheInvalidation,
  type PublicCacheTarget,
} from './cache-invalidation'

type Delivery = {
  state(intent: OutboxIntent): Promise<string>
  confirm(intent: OutboxIntent): Promise<void>
  fail(intent: OutboxIntent): Promise<void>
}

export function createCacheInvalidationHandler(
  delivery: Delivery,
  invalidate: (target: PublicCacheTarget) => Promise<void>,
): OutboxHandler {
  return {
    ...cacheInvalidationPolicy,
    async run({ intent, signal }) {
      try {
        const { target } = readCacheInvalidation(intent)
        if ((await delivery.state(intent)) === 'confirmed') return 'succeeded'
        if (signal.aborted) return 'retry'
        // The committed generation, not Next's deferred tag flush, is the read barrier.
        await delivery.confirm(intent)
        try {
          await invalidate(target)
        } catch {
          // Best-effort reclamation only: new reads already use the durable generation.
        }
        return 'succeeded'
      } catch (error) {
        if (signal.aborted || transient(error)) return 'retry'
        await delivery.fail(intent)
        return 'failed'
      }
    },
  }
}

function transient(error: unknown): boolean {
  const seen = new Set<unknown>()
  while (error && typeof error === 'object' && !seen.has(error)) {
    seen.add(error)
    const code = 'code' in error ? String(error.code) : ''
    const message = 'message' in error ? String(error.message) : ''
    if (
      code.startsWith('08') ||
      [
        '40001',
        '40P01',
        '57P01',
        '57P02',
        '57P03',
        '53300',
        '57014',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EHOSTUNREACH',
      ].includes(code) ||
      /^(Connection terminated|timeout exceeded when trying to connect|Query read timeout)/.test(
        message,
      )
    )
      return true
    error = 'cause' in error ? error.cause : undefined
  }
  return false
}
