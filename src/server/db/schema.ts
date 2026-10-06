import { pgSchema } from 'drizzle-orm/pg-core'

// Module-owned table descriptions are in place. The reviewed initial migration is #72.
export const appSchema = pgSchema('app')
