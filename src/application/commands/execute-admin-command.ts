import type { AdminSessionPort } from '../../modules/identity-access/application/command-access-port'
import type { AuditActor, AuditEventDraft } from '../../modules/governance/application/audit-port'
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
import { commandFailurePolicy, RejectedCommand, type RejectedOutcome } from './command-failure'
export { CommandConflict } from './command-failure'

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
  const reject = (outcome: RejectedOutcome) =>
    commandFailurePolicy.record(
      dependencies.transaction,
      { actor: auditActor, commandType: attemptType, correlationKey, commandKey },
      outcome,
    )
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
    return reject(commandFailurePolicy.classify(error))
  }
  for (let attempt = 0; attempt < commandFailurePolicy.maximumAttempts; attempt++) {
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
      const delay = commandFailurePolicy.retryDelay(error, attempt)
      if (delay !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      return reject(commandFailurePolicy.classify(error))
    }
  }
  return reject({ status: 'unavailable', code: 'persistence_unavailable' })
}
