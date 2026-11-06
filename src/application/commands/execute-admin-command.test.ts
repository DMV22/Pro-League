import { expect, it } from 'vitest'
import { executeAdminCommand } from './execute-admin-command'

it('rejects an incomplete session before accepting a command', async () => {
  expect(
    await executeAdminCommand(
      {
        session: {
          async verify() {
            return null
          },
        },
        transaction: {
          async run() {
            throw new Error('No authorized transaction')
          },
        },
      },
      {
        type: 'test.command',
        version: 1,
        resultFields: ['id'],
        validate: () => ({ valid: true as const, value: {} }),
        async run() {
          throw new Error('No authorized mutation')
        },
      },
      { idempotencyKey: 'one', payload: {} },
      { correlationKey: 'test-one' },
    ),
  ).toEqual({ status: 'unauthenticated' })
})
