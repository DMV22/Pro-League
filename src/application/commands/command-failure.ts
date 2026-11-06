import {
  AuditFailure,
  type AuditActor,
  type AuditPolicies,
} from '../../modules/governance/application/audit-port'
import { OutboxFailure } from '../../modules/operations/application/outbox-port'
import { CommandExecutionFailure } from '../../modules/operations/application/command-execution-port'
import { createCommandExecutionId } from '../../modules/operations/application/command-intent'
import { PersistenceFailure } from '../../shared/application/persistence'
import type { TransactionPort } from '../transaction'
import type { CommandOutcome } from './contracts'

export type RejectedOutcome = Exclude<CommandOutcome<never>, { status: 'succeeded' }>
export class CommandConflict extends Error {
  constructor(readonly conflictCode: 'stale_version' | 'domain_conflict') {
    super(conflictCode)
  }
}
export class RejectedCommand extends Error {
  constructor(readonly outcome: RejectedOutcome) {
    super(outcome.status)
  }
}

const failureAuditAction = 'admin.command_attempt'
const failureAuditPolicy = Object.freeze({
  requireReason: true,
  changeFields: Object.freeze([] as string[]),
})
const maximumAttempts = 3

/** Protected command policy only; the generic transaction adapter remains deny-by-default. */
export const commandFailurePolicy = Object.freeze({
  maximumAttempts,
  auditPolicies(policies: AuditPolicies = {}): AuditPolicies {
    if (Object.hasOwn(policies, failureAuditAction)) {
      const policy = policies[failureAuditAction]
      if (
        !policy ||
        typeof policy !== 'object' ||
        policy.requireReason !== true ||
        (policy.requireReference !== undefined && policy.requireReference !== false) ||
        !Array.isArray(policy.changeFields) ||
        policy.changeFields.length !== 0 ||
        Reflect.ownKeys(policy).some(
          (key) => !['requireReason', 'requireReference', 'changeFields'].includes(key as string),
        )
      )
        throw new Error('Reserved command failure Audit policy is incompatible')
    }
    return Object.freeze({ ...policies, [failureAuditAction]: failureAuditPolicy })
  },
  classify(error: unknown): RejectedOutcome {
    if (error instanceof RejectedCommand) return error.outcome
    if (error instanceof CommandConflict) return { status: 'conflict', code: error.conflictCode }
    if (error instanceof CommandExecutionFailure && error.kind === 'conflict')
      return { status: 'conflict', code: 'idempotency_conflict' }
    if (error instanceof AuditFailure) return { status: 'unavailable', code: 'audit_unavailable' }
    if (
      error instanceof PersistenceFailure &&
      ['conflict', 'reference', 'constraint'].includes(error.kind)
    )
      return { status: 'conflict', code: 'domain_conflict' }
    if (
      error instanceof PersistenceFailure ||
      error instanceof OutboxFailure ||
      error instanceof CommandExecutionFailure
    )
      return { status: 'unavailable', code: 'persistence_unavailable' }
    return { status: 'unavailable', code: 'unexpected_failure' }
  },
  retryDelay(error: unknown, attempt: number): number | undefined {
    if (
      attempt < maximumAttempts - 1 &&
      (error instanceof PersistenceFailure ||
        error instanceof AuditFailure ||
        error instanceof OutboxFailure) &&
      error.kind === 'retryable'
    )
      return 25 * (attempt + 1)
    return undefined
  },
  async record(
    transaction: TransactionPort,
    attempt: Readonly<{
      actor: AuditActor
      commandType: string
      correlationKey: string
      commandKey?: string
    }>,
    outcome: RejectedOutcome,
  ): Promise<RejectedOutcome> {
    try {
      // The executor has already rolled back; evidence commits in a separate transaction.
      await transaction.run(
        ({ audit }) =>
          audit.append({
            id: createCommandExecutionId(),
            actor: attempt.actor,
            action: failureAuditAction,
            outcome: ['forbidden', 'unauthenticated'].includes(outcome.status)
              ? 'denied'
              : 'failed',
            source: 'admin',
            correlationKey: attempt.correlationKey,
            commandKey: attempt.commandKey,
            targets: [],
            reason: `${attempt.commandType}:${outcome.status}`,
          }),
        { bounded: true },
      )
      return outcome
    } catch {
      return { status: 'unavailable', code: 'audit_unavailable' }
    }
  },
})
