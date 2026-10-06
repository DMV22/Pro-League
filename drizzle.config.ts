import { defineConfig } from 'drizzle-kit'

import { loadProjectEnv } from './scripts/db/load-env'

loadProjectEnv()

const migrationUrl = process.env.MIGRATION_DATABASE_URL

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/server/db/schema.ts', './src/modules/**/infrastructure/schema.ts'],
  out: './drizzle',
  migrations: {
    table: '__drizzle_migrations',
    schema: 'app',
  },
  ...(migrationUrl ? { dbCredentials: { url: migrationUrl } } : {}),
})
