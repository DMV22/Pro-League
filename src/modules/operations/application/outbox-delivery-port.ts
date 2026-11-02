export type OutboxLease = Readonly<{
  id: string
  version: bigint
  attemptCount: number
  intent: unknown
}>
export type ClaimOptions = Readonly<{ limit: number; leaseMs: number; maxAttempts: number }>
/** Eligible candidates locked by this claim, not physical SQL rows scanned.
 * scannedCount = leases.length + exhaustedCount, at most ClaimOptions.limit.
 * Zero scannedCount means no progress; empty leases alone do not mean that.
 */
export type OutboxClaimResult = Readonly<{
  leases: readonly OutboxLease[]
  scannedCount: number
  exhaustedCount: number
}>
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
  claim(options: ClaimOptions): Promise<OutboxClaimResult>
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
