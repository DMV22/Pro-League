import type { DeliveryResult, OutboxDeliveryPort } from './outbox-delivery-port'
import type { OutboxIntent } from './outbox-port'
import { validateOutbox } from './validate-outbox'
import {
  resolveDeliveryResult,
  resolveDispatchOptions,
  type DispatchOptions,
  type HandlerOutcome,
} from './delivery-policy'
export type { DispatchOptions } from './delivery-policy'

export type OutboxHandler = Readonly<{
  schemaVersion: number
  payloadFields: readonly string[]
  /** Must tolerate repeated/concurrent delivery with this stable downstream idempotency key. */
  run(
    input: Readonly<{ intent: OutboxIntent; idempotencyKey: string; signal: AbortSignal }>,
  ): Promise<HandlerOutcome>
}>
export type OutboxHandlers = Readonly<Record<string, OutboxHandler>>

export async function dispatchOutboxBatch(
  delivery: OutboxDeliveryPort,
  handlers: OutboxHandlers,
  options: DispatchOptions = {},
) {
  const policy = resolveDispatchOptions(options)
  const { maxMessages, maxDurationMs, leaseMs, maxAttempts, handlerTimeoutMs } = policy
  const summary = {
    scanned: 0,
    processed: 0,
    succeeded: 0,
    retry: 0,
    failed: 0,
    exhausted: 0,
    lostLease: 0,
  }
  const deadline = performance.now() + maxDurationMs
  while (summary.scanned < maxMessages && performance.now() < deadline) {
    // Claim just-in-time: queued handlers must not consume their lease while waiting in a local batch.
    const claim = await delivery.claim({ limit: 1, leaseMs, maxAttempts })
    summary.scanned += claim.scannedCount
    summary.exhausted += claim.exhaustedCount
    if (claim.scannedCount === 0) break
    const [lease] = claim.leases
    if (!lease) continue
    let result: DeliveryResult
    const type = (lease.intent as { messageType?: unknown } | null)?.messageType
    if (typeof type !== 'string' || !Object.hasOwn(handlers, type)) {
      result = resolveDeliveryResult({ kind: 'unknown_message_type' }, lease.attemptCount, policy)
    } else {
      let intent: OutboxIntent | undefined
      try {
        intent = validateOutbox(lease.intent as OutboxIntent, { [type]: handlers[type] })
      } catch {
        /* Malformed persisted messages never reach a handler. */
      }
      if (!intent)
        result = resolveDeliveryResult({ kind: 'invalid_message' }, lease.attemptCount, policy)
      else {
        const remaining = deadline - performance.now()
        const outcome =
          remaining <= 0
            ? 'timeout'
            : await invokeHandler(handlers[type], intent, Math.min(handlerTimeoutMs, remaining))
        result = resolveDeliveryResult({ kind: 'handler', outcome }, lease.attemptCount, policy)
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
