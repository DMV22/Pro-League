import { describe, expect, test } from 'vitest'

import { parseCommandEnvelope } from './envelope'

describe('protected command envelope', () => {
  test('preserves an explicit idempotency key and leaves payload validation to the command', () => {
    expect(
      parseCommandEnvelope({ idempotencyKey: 'request-123', payload: { title: 'Новина' } }),
    ).toEqual({
      valid: true,
      value: { idempotencyKey: 'request-123', payload: { title: 'Новина' } },
    })
  })

  test.each([
    '',
    ' request-123',
    'request 123',
    'a\nb',
    'a\n',
    'a\r',
    'a'.repeat(129),
    'ключ',
    123,
    null,
  ])(
    'rejects a malformed or oversized idempotency key without echoing it: %j',
    (idempotencyKey) => {
      expect(parseCommandEnvelope({ idempotencyKey, payload: {} })).toEqual({
        valid: false,
        issues: [{ field: 'idempotencyKey', code: 'invalid_format' }],
      })
    },
  )

  test.each(['actor', 'context', 'grant', 'commandType', 'payloadHash', 'actorScope', '__proto__'])(
    'rejects injected server context and unknown envelope fields: %s',
    (field) => {
      expect(
        parseCommandEnvelope({
          idempotencyKey: 'request-123',
          payload: {},
          [field]: { kind: 'system' },
        }),
      ).toEqual({ valid: false, issues: [{ field: 'command', code: 'unknown_field' }] })
    },
  )

  test('converts an exact decimal version to the existing bigint ExpectedVersion contract', () => {
    expect(
      parseCommandEnvelope({
        idempotencyKey: 'request-123',
        payload: {},
        expectedVersion: {
          id: '019a0123-4567-7890-abcd-0123456789ab',
          expectedVersion: '9223372036854775807',
        },
      }),
    ).toEqual({
      valid: true,
      value: {
        idempotencyKey: 'request-123',
        payload: {},
        expectedVersion: {
          id: '019a0123-4567-7890-abcd-0123456789ab',
          expectedVersion: 9223372036854775807n,
        },
      },
    })
  })

  test.each([
    undefined,
    null,
    [],
    'version',
    {},
    { id: 'not-a-record-id', expectedVersion: '1' },
    ...[0, 1, 1n, '0', '-1', '01', '1.5', '1e3', '9'.repeat(1000)].map((expectedVersion) => ({
      id: '019a0123-4567-7890-abcd-0123456789ab',
      expectedVersion,
    })),
  ])('rejects malformed explicit expected versions (case %#)', (expectedVersion) => {
    const result = parseCommandEnvelope({
      idempotencyKey: 'request-123',
      payload: {},
      expectedVersion,
    })
    expect(result.valid).toBe(false)
  })

  test('rejects version overflow without lossy numeric coercion', () => {
    expect(
      parseCommandEnvelope({
        idempotencyKey: 'request-123',
        payload: {},
        expectedVersion: {
          id: '019a0123-4567-7890-abcd-0123456789ab',
          expectedVersion: '9223372036854775808',
        },
      }),
    ).toEqual({ valid: false, issues: [{ field: 'expectedVersion', code: 'out_of_range' }] })
  })

  test('rejects extra fields inside expected version rather than accepting injected context', () => {
    expect(
      parseCommandEnvelope({
        idempotencyKey: 'request-123',
        payload: {},
        expectedVersion: {
          id: '019a0123-4567-7890-abcd-0123456789ab',
          expectedVersion: '1',
          actor: 'system',
        },
      }),
    ).toEqual({ valid: false, issues: [{ field: 'expectedVersion', code: 'unknown_field' }] })
  })

  test.each([
    undefined,
    null,
    [],
    'request',
    123,
    new Date(),
    Object.create({ idempotencyKey: 'request-123', payload: {} }),
  ])('rejects non-record and inherited envelopes (case %#)', (input) => {
    expect(parseCommandEnvelope(input)).toEqual({
      valid: false,
      issues: [{ field: 'command', code: 'invalid_shape' }],
    })
  })

  test.each([
    { idempotencyKey: 'request-123' },
    { idempotencyKey: 'request-123', payload: undefined },
  ])('requires an explicit payload (case %#)', (input) => {
    expect(parseCommandEnvelope(input)).toEqual({
      valid: false,
      issues: [{ field: 'payload', code: 'required' }],
    })
  })
})
