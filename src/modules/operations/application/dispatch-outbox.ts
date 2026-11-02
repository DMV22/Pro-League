import type { DeliveryResult, OutboxDeliveryPort } from './outbox-delivery-port'
import { OutboxFailure, type OutboxIntent } from './outbox-port'
import { validateOutbox } from './validate-outbox'

export type OutboxHandler = Readonly<{
  schemaVersion: number
  payloadFields: readonly string[]
  /** Must tolerate repeated/concurrent delivery with this stable downstream idempotency key. */
  run(
    input: Readonly<{ intent: OutboxIntent; idempotencyKey: string; signal: AbortSignal }>,
  ): Promise<'succeeded' | 'retry' | 'failed'>
}>
export type OutboxHandlers = Readonly<Record<string, OutboxHandler>>
export type DispatchOptions = Readonly<{
  maxMessages?: number
  maxDurationMs?: number
  leaseMs?: number
  maxAttempts?: number
  handlerTimeoutMs?: number
  baseBackoffMs?: number
}>

export async function dispatchOutboxBatch(
  delivery: OutboxDeliveryPort,
  handlers: OutboxHandlers,
  options: DispatchOptions = {},
) {
  const maxMessages = bounded(options.maxMessages ?? 20, 100)
  const maxDurationMs = bounded(options.maxDurationMs ?? 30_000, 300_000)
  const leaseMs = bounded(options.leaseMs ?? 30_000, 600_000)
  const maxAttempts = bounded(options.maxAttempts ?? 5, 20)
  const baseBackoffMs = bounded(options.baseBackoffMs ?? 1_000, 60_000)
  const handlerTimeoutMs = bounded(options.handlerTimeoutMs ?? 5_000, 20_000)
  if (leaseMs < handlerTimeoutMs + 5_000) throw new OutboxFailure('invalid')
  const summary = { processed: 0, succeeded: 0, retry: 0, failed: 0, exhausted: 0, lostLease: 0 }
  const deadline = performance.now() + maxDurationMs
  while (summary.processed < maxMessages && performance.now() < deadline) {
    // Claim just-in-time: queued handlers must not consume their lease while waiting in a local batch.
    const [lease] = await delivery.claim({ limit: 1, leaseMs, maxAttempts })
    if (!lease) break
    let result: DeliveryResult
    const type = (lease.intent as { messageType?: unknown } | null)?.messageType
    if (typeof type !== 'string' || !Object.hasOwn(handlers, type)) {
      result = { status: 'failed', code: 'unknown_message_type' }
    } else {
      let intent: OutboxIntent | undefined
      try {
        intent = validateOutbox(lease.intent as OutboxIntent, { [type]: handlers[type] })
      } catch {
        /* Malformed persisted messages never reach a handler. */
      }
      if (!intent) result = { status: 'failed', code: 'invalid_message' }
      else {
        const remaining = deadline - performance.now()
        const outcome =
          remaining <= 0
            ? 'timeout'
            : await invokeHandler(handlers[type], intent, Math.min(handlerTimeoutMs, remaining))
        if (outcome === 'succeeded') result = { status: 'succeeded', code: 'delivered' }
        else if (outcome === 'retry' || outcome === 'timeout') {
          const code = outcome === 'timeout' ? 'handler_timeout' : 'transient_failure'
          result =
            lease.attemptCount >= maxAttempts
              ? { status: 'exhausted', code }
              : {
                  status: 'retry',
                  code,
                  delayMs: Math.min(60_000, baseBackoffMs * 2 ** (lease.attemptCount - 1)),
                }
        } else result = { status: 'failed', code: 'handler_failure' }
      }
    }
    summary.processed += 1
    if (await delivery.settle(lease, result)) summary[result.status] += 1
    else summary.lostLease += 1
  }
  return summary
}

async function invokeHandler(handler: OutboxHandler, intent: OutboxIntent, timeoutMs: number) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(() =>
        handler.run({ intent, idempotencyKey: intent.id, signal: controller.signal }),
      ),
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => {
          resolve('timeout')
          controller.abort()
        }, timeoutMs)
      }),
    ])
  } catch {
    // Unknown failures are not blindly retried, and raw errors never enter the durable outcome.
    return 'failed' as const
  } finally {
    clearTimeout(timer)
  }
}

function bounded(value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new OutboxFailure('invalid')
  return value
}
