import 'server-only'
import { commandFailurePolicy } from '../../application/commands/command-failure'
import { createTransactionAdapter } from '../db/transaction'
import type { Database } from '../db/transaction-types'
import type { TransactionPort } from '../../application/transaction'

/** Explicit opt-in composition; no routes, provider adapters or runtime activation. */
export function createProtectedCommandTransaction(
  database: Database,
  options: NonNullable<Parameters<typeof createTransactionAdapter>[1]> = {},
): TransactionPort {
  return createTransactionAdapter(database, {
    ...options,
    auditPolicies: commandFailurePolicy.auditPolicies(options.auditPolicies),
  })
}
