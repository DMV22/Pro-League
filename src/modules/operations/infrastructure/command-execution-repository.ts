import { and, eq, sql } from 'drizzle-orm'
import {
  CommandExecutionFailure,
  type CommandExecutionPort,
  type SafeCommandResult,
} from '../application/command-execution-port'
import type { DatabaseTransaction } from '../../../server/db/transaction-types'
import { commandExecutions } from './schema'
import { mapDatabaseFailure } from '../../../server/db/failures'
import { PersistenceFailure } from '../../../shared/application/persistence'

export function createCommandExecutionRepository(tx: DatabaseTransaction): CommandExecutionPort {
  return {
    async claim(identity, id) {
      try {
        const [inserted] = await tx
          .insert(commandExecutions)
          .values({
            id,
            actorScope: identity.actorScope,
            idempotencyKey: identity.idempotencyKey,
            payloadHash: identity.payloadHash,
            resultType: identity.commandType,
            expiresAt: sql`clock_timestamp() + interval '30 days'`,
          })
          .onConflictDoNothing({
            target: [commandExecutions.actorScope, commandExecutions.idempotencyKey],
          })
          .returning({ id: commandExecutions.id })
        if (inserted) return { kind: 'claimed', id: inserted.id }
        const [row] = await tx
          .select()
          .from(commandExecutions)
          .where(
            and(
              eq(commandExecutions.actorScope, identity.actorScope),
              eq(commandExecutions.idempotencyKey, identity.idempotencyKey),
            ),
          )
          .for('update')
        if (!row) throw new CommandExecutionFailure('unavailable')
        if (row.payloadHash !== identity.payloadHash || row.resultType !== identity.commandType)
          throw new CommandExecutionFailure('conflict')
        // Legacy/pending/failed or unsupported results never trigger a second domain effect.
        if (row.state !== 'succeeded' || !row.resultSchemaVersion || !row.resultPayload)
          throw new CommandExecutionFailure('unavailable')
        return {
          kind: 'replay',
          result: {
            schemaVersion: row.resultSchemaVersion,
            value: row.resultPayload as SafeCommandResult,
          },
        }
      } catch (error) {
        throw executionFailure(error)
      }
    },
    async complete(id, result) {
      try {
        const rows = await tx
          .update(commandExecutions)
          .set({
            state: 'succeeded',
            resultSchemaVersion: result.schemaVersion,
            resultPayload: result.value,
            version: sql`${commandExecutions.version} + 1`,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(and(eq(commandExecutions.id, id), eq(commandExecutions.state, 'pending')))
          .returning({ id: commandExecutions.id })
        if (rows.length !== 1) throw new CommandExecutionFailure('unavailable')
      } catch (error) {
        throw executionFailure(error)
      }
    },
  }
}

// Operations storage failures are not domain/version conflicts. Only approved transient
// PostgreSQL failures retain their retry classification across this module's interface.
function executionFailure(error: unknown): Error {
  if (error instanceof CommandExecutionFailure) return error
  const failure = mapDatabaseFailure(error)
  if (failure instanceof PersistenceFailure && failure.kind === 'retryable') return failure
  return new CommandExecutionFailure('unavailable')
}
