import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.integration.ts'],
    testTimeout: 15_000,
  },
})
