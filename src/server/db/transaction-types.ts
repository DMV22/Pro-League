import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

// Repositories depend on the Drizzle surface, not on whether a Pool or one
// checked-out PoolClient owns the transaction.
export type Database = NodePgDatabase<Record<string, unknown>>
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
