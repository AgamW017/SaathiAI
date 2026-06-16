import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SECRET_KEY: 'test-secret-key',
    },
  },
});
