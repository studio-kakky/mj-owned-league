import { fileURLToPath } from 'node:url';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      // `cloudflare:workers` is a Workers-runtime virtual module that does not
      // exist under plain Vitest/jsdom. Server modules import it (transitively,
      // via `src/server/context.ts`) only for the `createServerFn` wrappers,
      // which the unit tests never call. Alias it to an inert stub so the
      // imports resolve; the tests drive the handlers with injected deps.
      'cloudflare:workers': fileURLToPath(
        new URL('./tests/unit/stubs/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
