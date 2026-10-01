import { pgSchema } from 'drizzle-orm/pg-core'

// Module-owned tables will be added in #69-#71. The initial migration is #72.
export const appSchema = pgSchema('app')
