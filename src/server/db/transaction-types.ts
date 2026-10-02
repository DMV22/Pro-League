import type { drizzle } from 'drizzle-orm/node-postgres'

export type Database = ReturnType<typeof drizzle>
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
