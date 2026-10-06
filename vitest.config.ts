import path from 'node:path'

import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve('./src') }],
  },
  test: {
    globals: true,
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'tests/accessibility/**'],
  },
})
