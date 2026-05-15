/**
 * Cloudflare Worker entry — minimal scope for issue #5.
 *
 * This is intentionally tiny: it provides just enough surface area to verify
 * that `wrangler dev --local` boots and the D1 binding is reachable. The full
 * TanStack Start ↔ Workers integration (SSR + server functions running on the
 * Workers runtime, with the D1 binding plumbed through to server functions)
 * is tracked as a follow-up to this issue.
 *
 * Routes:
 * - `GET /api/health`     — liveness probe, no D1 access
 * - `GET /api/db/ping`    — issues a trivial query against the D1 binding so
 *                           we can confirm the local Miniflare-backed D1 is
 *                           wired up correctly
 * Any other path returns 404 for now. The TanStack Start SSR entry will be
 * mounted here once the integration story stabilises.
 */

export interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
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
    // responding.
    const result = await env.DB.prepare('SELECT 1 AS ping').first<{ ping: number }>();
    return json({ status: 'ok', ping: result?.ping ?? null });
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

    return json({ status: 'not_found', path: url.pathname }, { status: 404 });
  },
};

export default worker;
