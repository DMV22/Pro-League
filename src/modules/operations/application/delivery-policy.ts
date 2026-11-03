import { OutboxFailure } from './outbox-port'

export type ClaimOptions = Readonly<{ limit: number; leaseMs: number; maxAttempts: number }>
export type DispatchOptions = Readonly<{
  maxMessages?: number
  maxDurationMs?: number
  leaseMs?: number
  maxAttempts?: number
  handlerTimeoutMs?: number
  baseBackoffMs?: number
}>
export type HandlerOutcome = 'succeeded' | 'retry' | 'failed'
export type DeliveryObservation =
  | Readonly<{ kind: 'unknown_message_type' | 'invalid_message' }>
  | Readonly<{ kind: 'handler'; outcome: unknown }>

const defaults = {
  maxMessages: 20,
  maxDurationMs: 30_000,
  leaseMs: 30_000,
  maxAttempts: 5,
  handlerTimeoutMs: 5_000,
  baseBackoffMs: 1_000,
} as const satisfies Required<DispatchOptions>
const maximum = {
  messages: 100,
  durationMs: 300_000,
  leaseMs: 600_000,
  attempts: 20,
  handlerTimeoutMs: 20_000,
  backoffMs: 60_000,
  retryDelayMs: 86_400_000,
} as const
const leaseSlackMs = 5_000

export function resolveDispatchOptions(options: DispatchOptions = {}): Required<DispatchOptions> {
  const resolved = {
    maxMessages: positive(options.maxMessages ?? defaults.maxMessages, maximum.messages),
    maxDurationMs: positive(options.maxDurationMs ?? defaults.maxDurationMs, maximum.durationMs),
    leaseMs: positive(options.leaseMs ?? defaults.leaseMs, maximum.leaseMs),
    maxAttempts: positive(options.maxAttempts ?? defaults.maxAttempts, maximum.attempts),
    handlerTimeoutMs: positive(
      options.handlerTimeoutMs ?? defaults.handlerTimeoutMs,
      maximum.handlerTimeoutMs,
    ),
    baseBackoffMs: positive(options.baseBackoffMs ?? defaults.baseBackoffMs, maximum.backoffMs),
  }
  if (resolved.leaseMs < resolved.handlerTimeoutMs + leaseSlackMs)
    throw new OutboxFailure('invalid')
  return resolved
}

export function validateClaimOptions(options: ClaimOptions): void {
  positive(options.limit, maximum.messages)
  positive(options.leaseMs, maximum.leaseMs)
  positive(options.maxAttempts, maximum.attempts)
}

export function validateProblemLimit(limit: number): void {
  positive(limit, maximum.messages)
}

const retryCodes = ['transient_failure', 'handler_timeout'] as const
const resultCodes = {
  succeeded: ['delivered'],
  retry: retryCodes,
  exhausted: retryCodes,
  failed: ['handler_failure', 'unknown_message_type', 'invalid_message'],
} as const

/** Derived from the same status/code catalog used for validation and diagnostics. */
export type DeliveryResult = {
  [Status in keyof typeof resultCodes]: Readonly<{
    status: Status
    code: (typeof resultCodes)[Status][number]
  }> &
    (Status extends 'retry' ? Readonly<{ delayMs: number }> : unknown)
}[keyof typeof resultCodes]

// Claim housekeeping is diagnostic evidence, not a result a live handler may settle.
export const exhaustedAttemptCode = 'attempt_limit'
const diagnosticCodes = new Set<string>([
  ...Object.values(resultCodes).flat(),
  exhaustedAttemptCode,
])

export function validateDeliveryResult(result: DeliveryResult): void {
  if (
    !result ||
    typeof result !== 'object' ||
    !Object.hasOwn(resultCodes, result.status) ||
    !(resultCodes[result.status] as readonly string[]).includes(result.code)
  )
    throw new OutboxFailure('invalid')
  // The settlement port permits up to a day; dispatcher backoff has a separate, shorter cap.
  if (result.status === 'retry') positive(result.delayMs, maximum.retryDelayMs)
}

/** Classify processing observations; callers do not construct persistent status/code pairs. */
export function resolveDeliveryResult(
  observation: DeliveryObservation,
  attemptCount: number,
  options: Pick<Required<DispatchOptions>, 'maxAttempts' | 'baseBackoffMs'>,
): DeliveryResult {
  if (observation.kind !== 'handler') return { status: 'failed', code: observation.kind }
  const outcome = observation.outcome
  if (outcome === 'succeeded') return { status: 'succeeded', code: 'delivered' }
  if (outcome === 'retry' || outcome === 'timeout') {
    const code = outcome === 'timeout' ? 'handler_timeout' : 'transient_failure'
    return attemptCount >= options.maxAttempts
      ? { status: 'exhausted', code }
      : {
          status: 'retry',
          code,
          delayMs: Math.min(maximum.backoffMs, options.baseBackoffMs * 2 ** (attemptCount - 1)),
        }
  }
  return { status: 'failed', code: 'handler_failure' }
}

export function safeDeliveryProblemCode(state: string, storedCode: unknown): string {
  if (state === 'leased') return 'lease_expired'
  return typeof storedCode === 'string' && diagnosticCodes.has(storedCode)
    ? storedCode
    : 'unclassified'
}

function positive(value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new OutboxFailure('invalid')
  return value
}
