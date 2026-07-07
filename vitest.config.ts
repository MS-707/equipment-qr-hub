import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // Playwright owns e2e/ — vitest's default glob would try to run those specs
    exclude: ['**/node_modules/**', 'e2e/**', 'test-results/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
