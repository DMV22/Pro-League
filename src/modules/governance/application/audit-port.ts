export type AuditScalar = string | number | boolean | null
export type AuditActor =
  | Readonly<{ kind: 'admin'; id: string; displayName: string; email?: string }>
  | Readonly<{ kind: 'system' | 'operator'; displayName: string }>

export type AuditEvidence =
  | Readonly<{
      kind: 'diff'
      schemaVersion: number
      changes: readonly Readonly<{ field: string; before: AuditScalar; after: AuditScalar }>[]
    }>
  | Readonly<{ kind: 'revision'; schemaVersion: number; type: string; id: string }>

/** Trusted server projections only; this is never a request-body or provider-payload DTO. */
export type AuditEventDraft = Readonly<{
  id: string
  actor: AuditActor
  action: string
  outcome: 'succeeded' | 'denied' | 'failed' | 'requested'
  source: 'admin' | 'operator' | 'job' | 'webhook' | 'system'
  correlationKey: string
  commandKey?: string
  reason?: string
  targets: readonly Readonly<{
    role: 'primary' | 'related' | 'affected'
    type: string
    id: string
    version?: bigint
    displayName?: string
  }>[]
  supportingReferenceIds?: readonly string[]
  evidence?: AuditEvidence
}>

export type AuditPolicy = Readonly<{
  requireReason: boolean
  requireReference?: boolean
  changeFields: readonly string[]
}>
export type AuditPolicies = Readonly<Record<string, AuditPolicy>>
export type AuditReceipt = Readonly<{ id: string; sequenceNumber: bigint; recordedAt: Date }>

export interface AuditPort {
  /** Append in the current transaction; an exception requires rollback, not a swallowed success. */
  append(event: AuditEventDraft): Promise<AuditReceipt>
}

export class AuditFailure extends Error {
  constructor(readonly kind: 'invalid' | 'conflict' | 'unavailable' | 'retryable') {
    super(`Audit ${kind}`)
    this.name = 'AuditFailure'
  }
}
