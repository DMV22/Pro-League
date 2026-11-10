// Compile-time characterization: a bare DB must not promise locks through command commit.
import type { Database } from '../../../server/db/transaction-types'
import type { createCommandAccess } from '../infrastructure/command-access'

type AssertFalse<T extends false> = T
export type CommandRequiresTransaction = AssertFalse<
  Database extends Parameters<typeof createCommandAccess>[0] ? true : false
>
