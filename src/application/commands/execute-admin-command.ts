import type { AdminSessionPort } from '../../modules/identity-access/application/command-access-port'
import {
  AuditFailure,
  type AuditActor,
  type AuditEventDraft,
} from '../../modules/governance/application/audit-port'
import type { OutboxIntent } from '../../modules/operations/application/outbox-port'
import type { SafeCommandResult } from '../../modules/operations/application/command-execution-port'
import type { CommandContext, AdminActor } from '../../shared/application/command-context'
import type { TransactionPort, TransactionRepositories } from '../transaction'
import type { CommandOutcome, CommandValidation } from './contracts'
import type { CommandEnvelope } from './envelope'
import { parseCommandEnvelope } from './envelope'
import { createHash, randomUUID } from 'node:crypto'
import {
  commandPayloadHash,
  snapshotCommandResult,
} from '../../modules/operations/application/command-values'
import { CommandExecutionFailure } from '../../modules/operations/application/command-execution-port'
import { PersistenceFailure } from '../../shared/application/persistence'
import { OutboxFailure } from '../../modules/operations/application/outbox-port'

export type AdminCommandDefinition<Input> = Readonly<{
  type: string
  version: number
  resultFields: readonly string[]
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
      outbox?: readonly (Omit<OutboxIntent, 'id' | 'correlationKey' | 'causationKey'> &
        Readonly<{ key: string }>)[]
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
  const executionId = executionRecordId()
  const correlationKey = context.correlationKey
  let auditActor: AuditActor = { kind: 'system', displayName: 'Protected command entry' }
  let commandKey: string | undefined
  let attemptType = 'unresolved'
  let request: CommandEnvelope<Input>
  let payloadHash: string
  let pinnedScope: string | undefined
  let pinnedSubject: string | undefined
  const reject = async (outcome: RejectedOutcome): Promise<CommandOutcome<SafeCommandResult>> => {
    try {
      // run() has already rolled back; failure evidence uses a new transaction.
      await dependencies.transaction.run(
        ({ audit }) =>
          audit.append({
            id: executionRecordId(),
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
    if (
      !/^[a-zA-Z][a-zA-Z0-9_.:-]{0,95}$/.test(definition.type) ||
      !Number.isSafeInteger(definition.version) ||
      definition.version < 1 ||
      definition.version > 2147483647
    )
      throw new Error('Invalid server definition')
    attemptType = definition.type
    const envelope = parseCommandEnvelope(inputSnapshot)
    if (!envelope.valid) throw new RejectedCommand({ status: 'invalid', issues: envelope.issues })
    commandKey = envelope.value.idempotencyKey
    const parsed = definition.validate(envelope.value.payload)
    if (!parsed.valid) throw new RejectedCommand({ status: 'invalid', issues: parsed.issues })
    request = structuredClone({ ...envelope.value, payload: parsed.value })
    payloadHash = commandPayloadHash([
      definition.type,
      definition.version,
      request.payload,
      request.expectedVersion ?? null,
    ])
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
          const actorScope = JSON.stringify([
            'admin-v1',
            access.actor.adminIdentityId,
            access.actor.accessGrantId,
            definition.type,
          ])
          if (pinnedScope !== undefined && pinnedScope !== actorScope)
            throw new RejectedCommand({ status: 'forbidden', code: 'access_denied' })
          pinnedScope = actorScope
          const claimed = await repositories.commandExecutions.claim(
            {
              actorScope,
              commandType: definition.type,
              idempotencyKey: request.idempotencyKey,
              payloadHash,
            },
            executionId,
          )
          if (claimed.kind === 'replay') {
            if (claimed.result.schemaVersion !== definition.version)
              throw new CommandExecutionFailure('unavailable')
            return {
              status: 'succeeded',
              value: snapshotCommandResult(claimed.result.value, definition.resultFields),
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
          const value = snapshotCommandResult(result.value, definition.resultFields)
          const intents = structuredClone(result.outbox ?? [])
          const intentKeys = new Set<string>()
          if (intents.length > 16) throw new CommandExecutionFailure('unavailable')
          for (const intent of intents) {
            if (
              !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/.test(intent.key) ||
              intentKeys.has(intent.key)
            )
              throw new CommandExecutionFailure('unavailable')
            intentKeys.add(intent.key)
          }
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
          for (const { key, ...intent } of intents)
            await repositories.outbox.enqueue({
              ...intent,
              id: intentId(executionId, key),
              correlationKey,
              causationKey: executionId,
            })
          await repositories.commandExecutions.complete(claimed.id, {
            schemaVersion: definition.version,
            value,
          })
          return { status: 'succeeded', value }
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

// UUIDv7 timestamp + crypto-random suffix, allocated once before transaction retries.
function executionRecordId(): string {
  const timestamp = Date.now().toString(16).padStart(12, '0')
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${randomUUID().slice(15)}`
}

// Preserve the execution's UUIDv7 time prefix; derive the effect suffix from its stable key.
function intentId(executionId: string, key: string): string {
  const hex = createHash('sha256')
    .update(JSON.stringify([executionId, key]))
    .digest('hex')
    .slice(0, 32)
    .split('')
  hex.splice(0, 12, ...executionId.replaceAll('-', '').slice(0, 12))
  hex[12] = '7'
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16)
  const value = hex.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
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
