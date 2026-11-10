import 'server-only'
import {
  executeAdminCommand,
  type AdminCommandDefinition,
} from '../../application/commands/execute-admin-command'
import type { TransactionPort } from '../../application/transaction'
import { getAdminSession } from '../auth/clerk-session'
import { readAdminAuthConfig } from '../auth/config'
import { getDatabase } from '../db/client'
import { createProtectedCommandTransaction } from './protected-command'

/** Trusted server composition only: definitions/policies never come from browser command input. */
export async function executeProtectedAdminCommand<Input>(
  definition: AdminCommandDefinition<Input>,
  input: unknown,
  context: Readonly<{ correlationKey: string }>,
  policies: NonNullable<Parameters<typeof createProtectedCommandTransaction>[1]> = {},
) {
  if (!readAdminAuthConfig())
    return { status: 'unavailable' as const, code: 'authorization_unavailable' as const }
  const transaction: TransactionPort = {
    run(command, options) {
      return createProtectedCommandTransaction(getDatabase(), policies).run(command, options)
    },
  }
  return executeAdminCommand(
    { session: getAdminSession(), transaction },
    definition,
    input,
    context,
  )
}
