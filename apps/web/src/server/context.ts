/**
 * Server-function execution context (Issue #39: TanStack Start ↔ Cloudflare D1).
 *
 * This module is the single bridge between a TanStack Start server function and
 * the two request-scoped resources every Owner-side handler needs:
 *
 *   1. A Drizzle client bound to the request's D1 database (`env.DB`).
 *   2. The *server-validated* owner id, derived from the Better Auth session
 *      cookie — never from a client-supplied field.
 *
 * Why these live together:
 *   Both are read from the Workers runtime `env` (via `cloudflare:workers`) and
 *   from the active request headers (via `getRequest()`). Centralising them
 *   means the per-screen server modules (`groups.ts`, `settings.ts`, …) stay
 *   declarative: their `createServerFn` wrappers call `requireOwnerId()` +
 *   `getRequestDb()` and forward the results into the testable handler, which
 *   takes its dependencies as plain arguments.
 *
 * Security boundary (the AC this closes):
 *   Before this issue every Owner server function accepted `ownerId` in its
 *   input validator and trusted it. The client (a `beforeLoad` that read the
 *   browser Better Auth session) supplied it. That is forgeable: a hand-crafted
 *   RPC body could pass any `ownerId` and read/write another owner's data,
 *   because the only enforcement was the ownership filter applied *to the
 *   passed id*. `requireOwnerId()` re-validates the signed session cookie
 *   against D1 server-side, so the id can no longer be chosen by the caller.
 */

import { env } from 'cloudflare:workers';
import { getRequest } from '@tanstack/react-start/server';
import { type AuthEnv, createAuth } from '../auth';
import { createDb, type Database } from '../db/client';

/**
 * The slice of the Workers `env` this app reads. `cloudflare:workers` types it
 * from the generated `worker-configuration.d.ts`; we re-assert the shape we
 * rely on so the cast lives in one place.
 */
type RequestEnv = AuthEnv;

const requestEnv = (): RequestEnv => env as unknown as RequestEnv;

/**
 * Returns a Drizzle client bound to the request's D1 database.
 *
 * Each Workers invocation receives its own `env`, and the D1 binding is
 * per-request, so this constructs a fresh client every call. The cost is a
 * thin wrapper allocation — Drizzle does not open a connection (D1 is a
 * binding, not a socket), so there is nothing to pool.
 */
export const getRequestDb = (): Database => createDb(requestEnv().DB);

/**
 * Thrown when a server function runs without a valid Better Auth session.
 *
 * Owner-side server functions are only ever reached after the `_owner`
 * `beforeLoad` gate has already redirected unauthenticated users to `/login`,
 * so in normal operation this never fires. It exists to make the failure mode
 * explicit and serialisable if a client calls an Owner RPC directly without a
 * session cookie (e.g. an expired session racing a navigation).
 */
export class UnauthenticatedError extends Error {
  constructor() {
    super('No valid session; the caller is not authenticated.');
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Validates the request's Better Auth session cookie against D1 and returns the
 * authenticated owner id (`owners.id === user.id`, see `auth/ensure-owner.ts`).
 *
 * Runs server-side in both execution modes of a server function:
 *   - During SSR it executes inline with access to the real request headers via
 *     `getRequest()`.
 *   - On a client navigation it is the RPC target the browser calls with its
 *     cookies attached.
 *
 * Throws {@link UnauthenticatedError} when there is no valid session, so
 * callers never accidentally proceed with an `undefined` owner id.
 */
export const requireOwnerId = async (): Promise<string> => {
  const request = getRequest();
  const auth = createAuth(requestEnv());
  const result = await auth.api.getSession({ headers: request.headers });
  if (!result?.user) throw new UnauthenticatedError();
  // `owners.id` is materialised to `user.id` by the Better Auth `user.create`
  // / `session.create` hooks (see `auth/index.ts`), so the session user id is
  // the canonical owner id used throughout the domain tables.
  return result.user.id;
};
