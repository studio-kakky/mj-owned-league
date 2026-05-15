/**
 * Browser-side Better Auth client (Issue #12 / S1 ログイン).
 *
 * The server half of Better Auth is built per-request in `src/auth/index.ts`
 * and mounted at `/api/auth/*` from the Worker. This module is its
 * client-side counterpart: a single `authClient` instance that the React
 * tree imports to call `signIn.social({ provider: 'google' })` and (later)
 * read `useSession()` for the active group / dashboard wiring.
 *
 * Why a separate file:
 *   - The server module imports `better-auth` + `drizzleAdapter` + the
 *     full Drizzle schema. None of that is safe to ship to the browser.
 *   - `better-auth/react` is a thin wrapper around the framework-agnostic
 *     client that adds `useSession()` etc. Keeping the singleton here
 *     gives every route file one canonical import.
 *
 * baseURL resolution:
 *   - In the browser the default is "same origin", which matches our setup
 *     (the Worker serves both the app and `/api/auth/*`). We deliberately
 *     do NOT hardcode `http://localhost:8787` etc. — production / preview
 *     deployments would need a build-time env, and Issue #12's scope is the
 *     screen, not the deployment pipeline.
 */

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

/**
 * Convenience re-exports for the call sites that don't want to thread the
 * whole `authClient` object. Keeps the screen code readable:
 *
 *   import { signIn } from '../auth/client';
 *   await signIn.social({ provider: 'google', callbackURL: '/' });
 */
export const { signIn, signOut, useSession } = authClient;
