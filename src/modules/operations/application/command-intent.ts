import { createHash, randomUUID } from 'node:crypto'
import type { AdminActor } from '../../../shared/application/command-context'
import type { ExpectedVersion } from '../../../shared/application/persistence'
import type { CommandExecutionIdentity } from '../../../application/commands/contracts'
import type { OutboxIntent } from './outbox-port'
import {
  CommandExecutionFailure,
  type SafeCommandResult,
  type RecordedCommandResult,
} from './command-execution-port'

export type CommandIntentRules = Readonly<{
  type: string
  version: number
  resultFields: readonly string[]
}>
export type CommandEffect = Omit<OutboxIntent, 'id' | 'correlationKey' | 'causationKey'> &
  Readonly<{ key: string }>
type CommandIntentInput = Readonly<{
  idempotencyKey: string
  payload: unknown
  expectedVersion?: Readonly<ExpectedVersion>
}>
type StoredCommandExecution = Readonly<{
  payloadHash: string
  resultType: string | null
  state: string
  resultSchemaVersion: number | null
  resultPayload: unknown
}>

/** Called before envelope parsing to retain the existing server-definition failure precedence. */
export function validateCommandIntentRules(rules: CommandIntentRules): void {
  if (
    !/^[a-zA-Z][a-zA-Z0-9_.:-]{0,95}$/.test(rules.type) ||
    !Number.isSafeInteger(rules.version) ||
    rules.version < 1 ||
    rules.version > 2147483647
  )
    throw new Error('Invalid server definition')
}

/** Prepare outside locks; fresh execution and replay share one Operations-owned policy. */
export function prepareCommandIntent(rules: CommandIntentRules, request: CommandIntentInput) {
  const payloadHash = commandPayloadHash([
    rules.type,
    rules.version,
    request.payload,
    request.expectedVersion ?? null,
  ])
  return {
    identity(
      actor: Pick<AdminActor, 'adminIdentityId' | 'accessGrantId'>,
    ): CommandExecutionIdentity {
      return {
        actorScope: JSON.stringify([
          'admin-v1',
          actor.adminIdentityId,
          actor.accessGrantId,
          rules.type,
        ]),
        commandType: rules.type,
        idempotencyKey: request.idempotencyKey,
        payloadHash,
      }
    },
    replay(recorded: RecordedCommandResult): SafeCommandResult {
      if (recorded.schemaVersion !== rules.version) throw new CommandExecutionFailure('unavailable')
      return snapshotCommandResult(recorded.value, rules.resultFields)
    },
    accept(
      result: Readonly<{ value: SafeCommandResult; outbox?: readonly CommandEffect[] }>,
      executionId: string,
      correlationKey: string,
    ) {
      const value = snapshotCommandResult(result.value, rules.resultFields)
      const effects = structuredClone(result.outbox ?? [])
      const keys = new Set<string>()
      if (effects.length > 16) throw new CommandExecutionFailure('unavailable')
      for (const effect of effects) {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/.test(effect.key) || keys.has(effect.key))
          throw new CommandExecutionFailure('unavailable')
        keys.add(effect.key)
      }
      return {
        recorded: { schemaVersion: rules.version, value } satisfies RecordedCommandResult,
        outbox: effects.map(({ key, ...effect }): OutboxIntent => ({
          ...effect,
          id: intentId(executionId, key),
          correlationKey,
          causationKey: executionId,
        })),
      }
    },
  }
}

/** The adapter supplies a locked row; policy decides whether it represents this recorded intent. */
export function readCommandExecution(
  identity: CommandExecutionIdentity,
  row: StoredCommandExecution | undefined,
): RecordedCommandResult {
  if (!row) throw new CommandExecutionFailure('unavailable')
  if (row.payloadHash !== identity.payloadHash || row.resultType !== identity.commandType)
    throw new CommandExecutionFailure('conflict')
  if (row.state !== 'succeeded' || !row.resultSchemaVersion || !row.resultPayload)
    throw new CommandExecutionFailure('unavailable')
  return { schemaVersion: row.resultSchemaVersion, value: row.resultPayload as SafeCommandResult }
}

// UUIDv7 timestamp + crypto-random suffix, allocated once before transaction retries.
export function createCommandExecutionId(): string {
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

/** Versioned tagged encoding: distinguishes arrays, objects, bigint, null and scalar types. */
function commandPayloadHash(value: unknown): string {
  let nodes = 0
  function encode(item: unknown, depth: number): unknown {
    if (++nodes > 2048 || depth > 8) throw new CommandExecutionFailure('unavailable')
    if (item === null) return ['null']
    if (typeof item === 'boolean' || typeof item === 'string') return [typeof item, item]
    if (typeof item === 'number' && Number.isFinite(item))
      return ['number', Object.is(item, -0) ? 0 : item]
    if (typeof item === 'bigint') return ['bigint', item.toString()]
    if (Array.isArray(item)) return ['array', Array.from(item, (value) => encode(value, depth + 1))]
    if (
      item &&
      typeof item === 'object' &&
      [Object.prototype, null].includes(Object.getPrototypeOf(item))
    ) {
      const keys = Reflect.ownKeys(item)
      if (
        keys.some(
          (key) =>
            typeof key !== 'string' ||
            !Object.hasOwn(Object.getOwnPropertyDescriptor(item, key)!, 'value'),
        )
      )
        throw new CommandExecutionFailure('unavailable')
      return [
        'object',
        (keys as string[])
          .sort()
          .map((key) => [key, encode((item as Record<string, unknown>)[key], depth + 1)]),
      ]
    }
    throw new CommandExecutionFailure('unavailable')
  }
  const encoded = JSON.stringify(['command-intent-v1', encode(value, 0)])
  if (Buffer.byteLength(encoded) > 32_768) throw new CommandExecutionFailure('unavailable')
  return createHash('sha256').update(encoded).digest('hex')
}

/** Projection allowlist, not arbitrary-string DLP; owning commands must select safe output fields. */
function snapshotCommandResult(value: unknown, fields: readonly string[]): SafeCommandResult {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    fields.length > 16
  )
    throw new CommandExecutionFailure('unavailable')
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== 'string' ||
      !fields.includes(key) ||
      !/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(key) ||
      /password|secret|token|cookie|email|credential|private|rawPayload/i.test(key) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')
    )
      throw new CommandExecutionFailure('unavailable')
    const item = (value as Record<string, unknown>)[key]
    if (
      item !== null &&
      typeof item !== 'boolean' &&
      !(typeof item === 'number' && Number.isSafeInteger(item)) &&
      !(typeof item === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(item))
    )
      throw new CommandExecutionFailure('unavailable')
  }
  if (Buffer.byteLength(JSON.stringify(value)) > 8192)
    throw new CommandExecutionFailure('unavailable')
  return structuredClone(value) as SafeCommandResult
}
