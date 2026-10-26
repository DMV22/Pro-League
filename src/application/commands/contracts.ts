import type { AdminActor, CommandContext } from '../../shared/application/command-context'
import type { CommandEnvelope } from './envelope'

export type CommandInputIssue = Readonly<{
  field: 'command' | 'idempotencyKey' | 'payload' | 'expectedVersion'
  code: 'invalid_shape' | 'unknown_field' | 'required' | 'invalid_format' | 'out_of_range'
}>

export type CommandValidation<T> =
  { valid: true; value: T } | { valid: false; issues: readonly CommandInputIssue[] }

export type CommandAccessFailure =
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; code: 'access_denied' }
  | { status: 'unavailable'; code: 'authorization_unavailable' }

/** A point-in-time decision. Revalidate the grant in the committing transaction, also on replay. */
export type AuthorizationDecision =
  { status: 'authorized'; actor: AdminActor } | CommandAccessFailure

/** Public results contain stable codes, never raw Error/SQL/provider messages. */
export type CommandOutcome<T> =
  | { status: 'succeeded'; value: T }
  | CommandAccessFailure
  | { status: 'invalid'; issues: readonly CommandInputIssue[] }
  | { status: 'conflict'; code: 'stale_version' | 'idempotency_conflict' | 'domain_conflict' }
  | {
      status: 'unavailable'
      code: 'audit_unavailable' | 'persistence_unavailable' | 'unexpected_failure'
    }

/** Internal only: scope and hash must be derived on the server, never accepted from the envelope. */
export type CommandExecutionIdentity = Readonly<{
  actorScope: string
  commandType: string
  idempotencyKey: string
  payloadHash: string
}>

/** Signature only. No executor or authorized runtime entry point is provided by these contracts. */
export type ProtectedAdminCommand<TInput, TResult> = (
  request: CommandEnvelope<TInput>,
  context: CommandContext<AdminActor>,
) => Promise<CommandOutcome<TResult>>
