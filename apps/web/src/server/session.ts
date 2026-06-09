/**
 * Server-side session probe for route `beforeLoad` gates.
 *
 * Why this exists (the bug it fixes):
 *   Route gates used to call the *browser* Better Auth client
 *   (`authClient.getSession()`) directly inside `beforeLoad`. That works in
 *   the browser — the same-origin `fetch` carries the session cookie — but
 *   `beforeLoad` ALSO runs on the server during SSR (every full-page load,
 *   including the Google OAuth callback's redirect to `/`). On the server the
 *   browser client's `fetch` does NOT forward the incoming request's `Cookie`
 *   header, so `getSession()` always resolved to `null` and the `_owner` gate
 *   bounced freshly-authenticated owners straight back to `/login`.
 *
 * The fix:
 *   Wrap Better Auth's *server* API in a `createServerFn`. A server function
 *   runs server-side in both cases — during SSR it executes inline with access
 *   to the real request via `getRequest()`, and on client navigations it is an
 *   RPC that the browser calls with cookies attached. Either way we read the
 *   actual request headers and hand them to `auth.api.getSession({ headers })`,
 *   which validates the signed session cookie against D1.
 *
 * Boundary:
 *   We deliberately project down to the few fields the gates need
 *   ({@link SessionUser}) instead of leaking Better Auth's full session shape
 *   into route files. `null` means "no valid session" — callers decide whether
 *   that is a redirect to `/login` (owner pages) or to `/` (the login page).
 */

import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { type AuthEnv, createAuth } from '../auth';

/** The slice of the authenticated user that route gates actually consume. */
export interface SessionUser {
  id: string;
  email: string;
  /** Better Auth populates this from Google's `name` claim; may be empty. */
  name: string;
}

/**
 * Returns the current owner's session user, or `null` when there is no valid
 * session. Safe to call from `beforeLoad` on both server and client.
 */
export const getSessionServerFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const request = getRequest();
    const auth = createAuth(env as unknown as AuthEnv);
    const result = await auth.api.getSession({ headers: request.headers });
    if (!result?.user) return null;
    return {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name ?? '',
    };
  },
);
