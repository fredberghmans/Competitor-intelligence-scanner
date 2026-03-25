import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // Print each test name as it runs for clear CI output
    reporter: 'verbose',
  },
  resolve: {
    alias: {
      // Mirror the @/* path alias from tsconfig.json
      '@': path.resolve(__dirname, '.'),
    },
  },
})
