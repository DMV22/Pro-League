import type { AdminSessionPort } from '../../modules/identity-access/application/command-access-port'
import {
  AuditFailure,
  type AuditActor,
  type AuditEventDraft,
} from '../../modules/governance/application/audit-port'
import type { SafeCommandResult } from '../../modules/operations/application/command-execution-port'
import type { CommandContext, AdminActor } from '../../shared/application/command-context'
import type { TransactionPort, TransactionRepositories } from '../transaction'
import type { CommandOutcome, CommandValidation } from './contracts'
import type { CommandEnvelope } from './envelope'
import { parseCommandEnvelope } from './envelope'
import {
  createCommandExecutionId,
  prepareCommandIntent,
  validateCommandIntentRules,
  type CommandEffect,
  type CommandIntentRules,
} from '../../modules/operations/application/command-intent'
import { CommandExecutionFailure } from '../../modules/operations/application/command-execution-port'
import { PersistenceFailure } from '../../shared/application/persistence'
import { OutboxFailure } from '../../modules/operations/application/outbox-port'

export type AdminCommandDefinition<Input> = CommandIntentRules &
  Readonly<{
    validate(payload: unknown): CommandValidation<Input>
    /** Trusted module code only; no external I/O. Only domain repositories are exposed. */
    run(
      input: CommandEnvelope<Input>,
      context: CommandContext<AdminActor>,
      repositories: Pick<TransactionRepositories, 'competition' | 'registration' | 'match'>,
    ): Promise<
      Readonly<{
        value: SafeCommandResult
        audit: Pick<AuditEventDraft, 'targets' | 'reason' | 'supportingReferenceIds' | 'evidence'>
        outbox?: readonly CommandEffect[]
      }>
    >
  }>
export type AdminCommandDependencies = Readonly<{
  session: AdminSessionPort
  transaction: TransactionPort
}>

/** Owning commands explicitly distinguish version conflicts from other domain conflicts. */
export class CommandConflict extends Error {
  constructor(readonly conflictCode: 'stale_version' | 'domain_conflict') {
    super(conflictCode)
  }
}
type RejectedOutcome = Exclude<CommandOutcome<SafeCommandResult>, { status: 'succeeded' }>
class RejectedCommand extends Error {
  constructor(readonly outcome: RejectedOutcome) {
    super(outcome.status)
  }
}

export async function executeAdminCommand<Input>(
  dependencies: AdminCommandDependencies,
  definition: AdminCommandDefinition<Input>,
  input: unknown,
  context: Readonly<{ correlationKey: string }>,
): Promise<CommandOutcome<SafeCommandResult>> {
  const executionId = createCommandExecutionId()
  const correlationKey = context.correlationKey
  let auditActor: AuditActor = { kind: 'system', displayName: 'Protected command entry' }
  let commandKey: string | undefined
  let attemptType = 'unresolved'
  let request: CommandEnvelope<Input>
  let intent: ReturnType<typeof prepareCommandIntent>
  let pinnedScope: string | undefined
  let pinnedSubject: string | undefined
  const reject = async (outcome: RejectedOutcome): Promise<CommandOutcome<SafeCommandResult>> => {
    try {
      // run() has already rolled back; failure evidence uses a new transaction.
      await dependencies.transaction.run(
        ({ audit }) =>
          audit.append({
            id: createCommandExecutionId(),
            actor: auditActor,
            action: 'admin.command_attempt',
            outcome: ['forbidden', 'unauthenticated'].includes(outcome.status)
              ? 'denied'
              : 'failed',
            source: 'admin',
            correlationKey,
            commandKey,
            targets: [],
            reason: `${attemptType}:${outcome.status}`,
          }),
        { bounded: true },
      )
      return outcome
    } catch {
      return { status: 'unavailable', code: 'audit_unavailable' }
    }
  }
  // Snapshot before authentication yields; transport adapters still enforce body-size limits.
  let inputSnapshot: unknown
  let snapshotFailed = false
  try {
    inputSnapshot = structuredClone(input)
  } catch {
    snapshotFailed = true
  }
  let initialSession
  try {
    initialSession = await dependencies.session.verify()
  } catch {
    return reject({ status: 'unavailable', code: 'authorization_unavailable' })
  }
  if (!initialSession) return { status: 'unauthenticated' }
  initialSession = { ...initialSession }
  try {
    if (snapshotFailed)
      throw new RejectedCommand({
        status: 'invalid',
        issues: [{ field: 'command', code: 'invalid_shape' }],
      })
    validateCommandIntentRules(definition)
    attemptType = definition.type
    const envelope = parseCommandEnvelope(inputSnapshot)
    if (!envelope.valid) throw new RejectedCommand({ status: 'invalid', issues: envelope.issues })
    commandKey = envelope.value.idempotencyKey
    const parsed = definition.validate(envelope.value.payload)
    if (!parsed.valid) throw new RejectedCommand({ status: 'invalid', issues: parsed.issues })
    request = structuredClone({ ...envelope.value, payload: parsed.value })
    intent = prepareCommandIntent(definition, request)
  } catch (error) {
    return reject(outcomeOf(error))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    let session
    try {
      session = attempt === 0 ? initialSession : await dependencies.session.verify()
    } catch {
      return reject({ status: 'unavailable', code: 'authorization_unavailable' })
    }
    // A retry can lose its session after a rolled-back authenticated attempt.
    if (!session) return reject({ status: 'unauthenticated' })
    session = { ...session }
    if (pinnedSubject !== undefined && session.subject !== pinnedSubject)
      return reject({ status: 'forbidden', code: 'access_denied' })
    pinnedSubject = session.subject
    try {
      return await dependencies.transaction.run(
        async (repositories) => {
          const access = await repositories.commandAccess.authorize(session)
          if (!access) throw new RejectedCommand({ status: 'forbidden', code: 'access_denied' })
          const actorSnapshot: AuditActor = {
            kind: 'admin',
            id: access.actor.adminIdentityId,
            displayName: access.displayName,
            email: access.email,
          }
          auditActor = actorSnapshot
          const identity = intent.identity(access.actor)
          const actorScope = identity.actorScope
          if (pinnedScope !== undefined && pinnedScope !== actorScope)
            throw new RejectedCommand({ status: 'forbidden', code: 'access_denied' })
          pinnedScope = actorScope
          const claimed = await repositories.commandExecutions.claim(identity, executionId)
          if (claimed.kind === 'replay') {
            return {
              status: 'succeeded',
              value: intent.replay(claimed.result),
            }
          }
          const result = await definition.run(
            structuredClone(request),
            { actor: access.actor, correlationKey },
            {
              competition: repositories.competition,
              registration: repositories.registration,
              match: repositories.match,
            },
          )
          const accepted = intent.accept(result, executionId, correlationKey)
          await repositories.audit.append({
            ...result.audit,
            id: executionId,
            actor: actorSnapshot,
            action: definition.type,
            outcome: 'succeeded',
            source: 'admin',
            correlationKey,
            commandKey: request.idempotencyKey,
          })
          for (const effect of accepted.outbox) await repositories.outbox.enqueue(effect)
          await repositories.commandExecutions.complete(claimed.id, accepted.recorded)
          return { status: 'succeeded', value: accepted.recorded.value }
        },
        { bounded: true },
      )
    } catch (error) {
      if (
        attempt < 2 &&
        (error instanceof PersistenceFailure ||
          error instanceof AuditFailure ||
          error instanceof OutboxFailure) &&
        error.kind === 'retryable'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
        continue
      }
      return reject(outcomeOf(error))
    }
  }
  return reject({ status: 'unavailable', code: 'persistence_unavailable' })
}

function outcomeOf(error: unknown): RejectedOutcome {
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
}
