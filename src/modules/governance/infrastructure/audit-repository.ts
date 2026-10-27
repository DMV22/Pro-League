import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { AuditFailure, type AuditPolicies, type AuditPort } from '../application/audit-port'
import { validateAudit } from '../application/validate-audit'
import type { DatabaseTransaction } from '../../../server/db/transaction-types'
import { mapDatabaseFailure } from '../../../server/db/failures'
import { PersistenceFailure } from '../../../shared/application/persistence'
import { auditEvents, auditEventTargets, auditEventChanges, supportingReferences } from './schema'

export function createAuditRepository(tx: DatabaseTransaction, policies: AuditPolicies): AuditPort {
  return {
    async append(input) {
      const event = validateAudit(input, policies)
      try {
        if (event.supportingReferenceIds?.length) {
          const found = await tx
            .select({ id: supportingReferences.id })
            .from(supportingReferences)
            .where(inArray(supportingReferences.id, [...event.supportingReferenceIds]))
          if (found.length !== event.supportingReferenceIds.length)
            throw new AuditFailure('invalid')
        }
        const [receipt] = await tx
          .insert(auditEvents)
          .values({
            id: event.id,
            actorKind: event.actor.kind,
            actorAdminIdentityId: event.actor.kind === 'admin' ? event.actor.id : null,
            actorDisplaySnapshot: event.actor.displayName,
            actorEmailSnapshot: event.actor.kind === 'admin' ? event.actor.email : null,
            action: event.action,
            outcome: event.outcome,
            reason: event.reason,
            source: event.source,
            correlationKey: event.correlationKey,
            commandKey: event.commandKey,
          })
          .returning({
            id: auditEvents.id,
            sequenceNumber: auditEvents.sequenceNumber,
            recordedAt: auditEvents.recordedAt,
          })
        if (event.targets.length)
          await tx.insert(auditEventTargets).values(
            event.targets.map((target) => ({
              id: auditId(),
              auditEventId: event.id,
              role: target.role,
              targetType: target.type,
              targetId: target.id,
              targetVersion: target.version,
              displaySnapshot: target.displayName,
            })),
          )
        if (event.evidence?.kind === 'diff')
          await tx.insert(auditEventChanges).values({
            id: auditId(),
            auditEventId: event.id,
            schemaVersion: event.evidence.schemaVersion,
            redactedDiff: event.evidence.changes,
          })
        if (event.evidence?.kind === 'revision')
          await tx.insert(auditEventChanges).values({
            id: auditId(),
            auditEventId: event.id,
            schemaVersion: event.evidence.schemaVersion,
            revisionType: event.evidence.type,
            revisionId: event.evidence.id,
          })
        if (event.supportingReferenceIds?.length)
          await tx.insert(auditEventTargets).values(
            event.supportingReferenceIds.map((id) => ({
              id: auditId(),
              auditEventId: event.id,
              role: 'related',
              targetType: 'supporting_reference',
              targetId: id,
            })),
          )
        return receipt
      } catch (error) {
        if (error instanceof AuditFailure) throw error
        const failure = mapDatabaseFailure(error)
        throw new AuditFailure(
          failure instanceof PersistenceFailure && ['conflict', 'retryable'].includes(failure.kind)
            ? (failure.kind as 'conflict' | 'retryable')
            : 'unavailable',
        )
      }
    },
  }
}

// UUIDv7: 48-bit millisecond timestamp with crypto-random suffix; not a security token or clock order proof.
function auditId(): string {
  const timestamp = Date.now().toString(16).padStart(12, '0')
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${randomUUID().slice(15)}`
}
