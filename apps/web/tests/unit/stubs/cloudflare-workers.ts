/**
 * Test stub for the `cloudflare:workers` virtual module.
 *
 * The real module is provided by the Workers runtime (and by
 * `@cloudflare/vite-plugin` during `vite dev` / build). It does not exist in
 * the plain Vitest/jsdom environment, so importing any server module that pulls
 * in `src/server/context.ts` (which reads `env`) would fail to resolve.
 *
 * The unit tests never exercise the `createServerFn` wrappers — those are thin
 * adapters that call `requireOwnerId()` + `getRequestDb()` and need the real
 * Workers `env`. The tests drive the *handlers* directly with an injected
 * owner id and (optionally) an injected Drizzle `db`. So this stub only needs
 * to make the import resolve; its `env` is a deliberately empty object. Any
 * test that accidentally hits a code path reading `env.DB` will throw a clear
 * "Cannot read properties of undefined" rather than silently passing — which is
 * the behaviour we want.
 *
 * Wired via the `cloudflare:workers` alias in `vitest.config.ts`.
 */

export const env = {} as Record<string, unknown>;
