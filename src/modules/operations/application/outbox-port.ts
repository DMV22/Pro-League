export type OutboxIntent = Readonly<{
  /** Allocate once per intent; reuse on retry. Never accept this projection from an HTTP body. */
  id: string
  messageType: string
  schemaVersion: number
  payload: Readonly<Record<string, string | number | boolean | null>>
  aggregateType: string
  aggregateId: string
  aggregateVersion: bigint
  correlationKey: string
  causationKey: string
}>

export type OutboxPolicies = Readonly<
  Record<
    string,
    Readonly<{
      schemaVersion: number
      payloadFields: readonly string[]
    }>
  >
>

export interface OutboxPort {
  enqueue(intent: OutboxIntent): Promise<void>
}

export class OutboxFailure extends Error {
  constructor(readonly kind: 'invalid' | 'conflict' | 'retryable' | 'unavailable') {
    super(`Outbox ${kind}`)
    this.name = 'OutboxFailure'
  }
}
