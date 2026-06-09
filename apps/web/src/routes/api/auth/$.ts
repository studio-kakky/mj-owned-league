/**
 * Better Auth mount point as a TanStack Start server route (Issue #7 follow-up:
 * TanStack Start ↔ Workers integration).
 *
 * Every path under `/api/auth/*` — sign-in, sign-out, OAuth callbacks, session
 * refresh — is owned by Better Auth's request handler. This splat route (`$.ts`)
 * captures all of them and delegates to `createAuth(env).handler(request)`.
 *
 * Why this replaces the old `worker/index.ts` branch:
 *   - With `@cloudflare/vite-plugin`, the SSR environment runs inside workerd,
 *     so server routes have access to the Cloudflare bindings (D1, secrets) via
 *     the `cloudflare:workers` `env` import — the same bindings the standalone
 *     Worker used to read from its `fetch(request, env)` signature.
 *   - One origin now serves both the app and `/api/auth/*`, so the browser-side
 *     `authClient` (same-origin baseURL) reaches this handler directly.
 *
 * `createAuth` is a per-request factory (see `src/auth/index.ts`): constructing
 * it here is cheap and keeps the D1 binding request-scoped.
 */

import { env } from 'cloudflare:workers';
import { createFileRoute } from '@tanstack/react-router';
import { type AuthEnv, createAuth } from '../../../auth';

// `cloudflare:workers` `env` is typed from the generated `worker-configuration.d.ts`.
// It structurally provides the D1 binding + secrets that `AuthEnv` requires.
const handler = ({ request }: { request: Request }): Response | Promise<Response> =>
  createAuth(env as unknown as AuthEnv).handler(request);

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
