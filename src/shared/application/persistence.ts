export type PersistenceFailureKind =
  'conflict' | 'constraint' | 'reference' | 'retryable' | 'unavailable'

export class PersistenceFailure extends Error {
  constructor(
    readonly kind: PersistenceFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'PersistenceFailure'
  }
}

export type VersionedEntity = { id: string; version: bigint }

export type ExpectedVersion = { id: string; expectedVersion: bigint }
