/**
 * Cloudflare Worker entry — minimal scope for issues #5, #6, and #7.
 *
 * This file is intentionally tiny: it provides just enough surface area to
 * verify that `wrangler dev --local` boots (#5), the Drizzle client can
 * round-trip a typed query against D1 (#6), and Better Auth's request
 * handler is mounted on `/api/auth/*` (#7). The full TanStack Start ↔
 * Workers integration (SSR + server functions running on the Workers
 * runtime, with the D1 binding plumbed through to server functions) is
 * tracked as a follow-up issue.
 *
 * Routes:
 * - `GET /api/health`           — liveness probe, no D1 access
 * - `GET /api/db/ping`          — raw `SELECT 1` against the D1 binding
 * - `GET /api/db/drizzle-ping`  — Drizzle round-trip into `ping_checks`
 * - `ANY /api/auth/*`           — delegated to Better Auth's handler
 *
 * Any other path returns 404 for now.
 */

import { desc } from 'drizzle-orm';
import { type AuthEnv, createAuth } from '../src/auth';
import { createDb } from '../src/db/client';
import { pingChecks } from '../src/db/schema';

export interface Env extends AuthEnv {
  // `AuthEnv` already declares `DB`, `BETTER_AUTH_SECRET`,
  // `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  // and `BETTER_AUTH_URL`. Worker-only bindings (queues, KV, etc.)
  // would be added here when they land.
}

const json = (data: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });

const handleHealth = (): Response => json({ status: 'ok' });

const handleDbPing = async (env: Env): Promise<Response> => {
  try {
    // SQLite always returns 1 for `SELECT 1`. This is the cheapest possible
    // round-trip to confirm the binding is wired and Miniflare's local D1 is
    // responding. Kept as a low-level escape hatch separate from the Drizzle
    // path below.
    const result = await env.DB.prepare('SELECT 1 AS ping').first<{ ping: number }>();
    return json({ status: 'ok', ping: result?.ping ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ status: 'error', message }, { status: 500 });
  }
};

const handleDrizzlePing = async (env: Env): Promise<Response> => {
  try {
    const db = createDb(env.DB);

    // Insert a marker row, then read the most recent row back. If the
    // migration for `ping_checks` has not been applied yet, the insert will
    // fail loudly here, which is exactly the smoke test we want.
    const [inserted] = await db
      .insert(pingChecks)
      .values({ label: `worker-ping-${Date.now()}` })
      .returning();

    const [latest] = await db.select().from(pingChecks).orderBy(desc(pingChecks.id)).limit(1);

    return json({ status: 'ok', inserted, latest });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ status: 'error', message }, { status: 500 });
  }
};

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return handleHealth();
    }

    if (request.method === 'GET' && url.pathname === '/api/db/ping') {
      return handleDbPing(env);
    }

    if (request.method === 'GET' && url.pathname === '/api/db/drizzle-ping') {
      return handleDrizzlePing(env);
    }

    // Better Auth owns every path under `/api/auth/*` — sign-in, sign-out,
    // OAuth callbacks, session refresh, etc. We construct the auth instance
    // per request (cheap; the heavy lifting is cached inside Better Auth)
    // so each request sees its own D1 binding via the factory.
    if (url.pathname.startsWith('/api/auth/')) {
      const auth = createAuth(env);
      return auth.handler(request);
    }

    return json({ status: 'not_found', path: url.pathname }, { status: 404 });
  },
};

export default worker;
