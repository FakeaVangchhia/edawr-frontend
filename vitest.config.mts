import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    // jsdom, because the units under test are localStorage-backed: the cart
    // store subscribes to the `storage` event and reads/writes localStorage,
    // and testing that against a hand-rolled stub would be testing the stub.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
