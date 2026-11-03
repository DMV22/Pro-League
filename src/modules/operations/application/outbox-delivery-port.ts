import type { ClaimOptions, DeliveryResult } from './delivery-policy'
export type { ClaimOptions, DeliveryResult } from './delivery-policy'

export type OutboxLease = Readonly<{
  id: string
  version: bigint
  attemptCount: number
  intent: unknown
}>
/** Eligible candidates locked by this claim, not physical SQL rows scanned.
 * scannedCount = leases.length + exhaustedCount, at most ClaimOptions.limit.
 * Zero scannedCount means no progress; empty leases alone do not mean that.
 */
export type OutboxClaimResult = Readonly<{
  leases: readonly OutboxLease[]
  scannedCount: number
  exhaustedCount: number
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
