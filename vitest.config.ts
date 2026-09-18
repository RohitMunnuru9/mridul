import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests for the parts of this shop that are worth pinning down.
 *
 * Not everything — the pages are checked by building them and looking at them,
 * and a test that renders a panel mostly asserts that the panel is still the
 * panel. What is here is the code where being wrong is expensive and quiet:
 * the payment cipher, the rules about whether money has arrived, and the
 * arithmetic that decides what somebody is charged.
 *
 * Node environment: none of it touches a DOM, and `packages/payments` refuses
 * to load in anything that looks like a browser.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@mridul/payments/ccavenue': fileURLToPath(
        new URL('./packages/payments/src/ccavenue.ts', import.meta.url),
      ),
      '@mridul/utils': fileURLToPath(new URL('./packages/utils/src/index.ts', import.meta.url)),
      '@mridul/shipping': fileURLToPath(
        new URL('./packages/shipping/src/index.ts', import.meta.url),
      ),
      '@mridul/database': fileURLToPath(
        new URL('./packages/database/src/index.ts', import.meta.url),
      ),
      '@mridul/supabase': fileURLToPath(
        new URL('./packages/supabase/src/index.ts', import.meta.url),
      ),
      '@mridul/types': fileURLToPath(
        new URL('./packages/types/src/index.ts', import.meta.url),
      ),
      '@mridul/validation': fileURLToPath(
        new URL('./packages/validation/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
