import type { CommandExecutionIdentity } from '../../../application/commands/contracts'

export type SafeCommandResult = Readonly<Record<string, string | number | boolean | null>>
export type RecordedCommandResult = Readonly<{ schemaVersion: number; value: SafeCommandResult }>
export interface CommandExecutionPort {
  /** Same transaction as domain writes; a competing identical claim waits for commit/rollback. */
  claim(
    identity: CommandExecutionIdentity,
    id: string,
  ): Promise<{ kind: 'claimed'; id: string } | { kind: 'replay'; result: RecordedCommandResult }>
  complete(id: string, result: RecordedCommandResult): Promise<void>
}
export class CommandExecutionFailure extends Error {
  constructor(readonly kind: 'conflict' | 'unavailable') {
    super(`Command execution ${kind}`)
  }
}
