export type OutboxLease = Readonly<{
  id: string
  version: bigint
  attemptCount: number
  intent: unknown
}>
export type ClaimOptions = Readonly<{ limit: number; leaseMs: number; maxAttempts: number }>
export type DeliveryResult =
  | Readonly<{ status: 'succeeded'; code: 'delivered' }>
  | Readonly<{ status: 'retry'; code: 'transient_failure' | 'handler_timeout'; delayMs: number }>
  | Readonly<{ status: 'exhausted'; code: 'transient_failure' | 'handler_timeout' }>
  | Readonly<{
      status: 'failed'
      code: 'handler_failure' | 'unknown_message_type' | 'invalid_message'
    }>

/** Internal worker interface. A lease is not an HTTP capability or an authorization decision. */
export interface OutboxDeliveryPort {
  claim(options: ClaimOptions): Promise<readonly OutboxLease[]>
  settle(lease: Pick<OutboxLease, 'id' | 'version'>, result: DeliveryResult): Promise<boolean>
  listProblems(limit: number): Promise<
    readonly Readonly<{
      id: string
      version: bigint
      state: string
      attemptCount: number
      code: string
    }>[]
  >
}
