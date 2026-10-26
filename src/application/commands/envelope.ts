import type { ExpectedVersion } from '../../shared/application/persistence'

import type { CommandValidation } from './contracts'

export type CommandEnvelope<T = unknown> = Readonly<{
  idempotencyKey: string
  payload: T
  expectedVersion?: Readonly<ExpectedVersion>
  actor?: never
  context?: never
}>

/** Validates transport metadata only. Payload remains unknown until the owning command validates it. */
export function parseCommandEnvelope(input: unknown): CommandValidation<CommandEnvelope> {
  if (!isRecord(input)) {
    return { valid: false, issues: [{ field: 'command', code: 'invalid_shape' }] }
  }
  const request = input
  if (
    Object.keys(request).some(
      (key) => !['idempotencyKey', 'payload', 'expectedVersion'].includes(key),
    )
  ) {
    return { valid: false, issues: [{ field: 'command', code: 'unknown_field' }] }
  }
  if (
    typeof request.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(request.idempotencyKey)
  ) {
    return { valid: false, issues: [{ field: 'idempotencyKey', code: 'invalid_format' }] }
  }
  if (!Object.hasOwn(request, 'payload') || request.payload === undefined) {
    return { valid: false, issues: [{ field: 'payload', code: 'required' }] }
  }
  const value: CommandEnvelope = {
    idempotencyKey: request.idempotencyKey,
    payload: request.payload,
  }
  if (!Object.hasOwn(request, 'expectedVersion')) return { valid: true, value }
  const expected = request.expectedVersion
  if (!isRecord(expected)) {
    return { valid: false, issues: [{ field: 'expectedVersion', code: 'invalid_shape' }] }
  }
  const version = expected
  if (Object.keys(version).some((key) => !['id', 'expectedVersion'].includes(key))) {
    return { valid: false, issues: [{ field: 'expectedVersion', code: 'unknown_field' }] }
  }
  if (
    typeof version.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(version.id) ||
    typeof version.expectedVersion !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(version.expectedVersion)
  ) {
    return { valid: false, issues: [{ field: 'expectedVersion', code: 'invalid_format' }] }
  }
  const expectedVersion = BigInt(version.expectedVersion)
  if (expectedVersion > 9223372036854775807n) {
    return { valid: false, issues: [{ field: 'expectedVersion', code: 'out_of_range' }] }
  }
  return {
    valid: true,
    value: {
      ...value,
      expectedVersion: { id: version.id.toLowerCase(), expectedVersion },
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  )
}
