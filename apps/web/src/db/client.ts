/**
 * Drizzle client factory for Cloudflare D1.
 *
 * The Workers runtime injects a `D1Database` binding (see `wrangler.toml` →
 * `[[d1_databases]] binding = "DB"`). We wrap that binding with Drizzle's
 * D1 driver so server code can use a typed query builder instead of raw SQL.
 *
 * Usage from a Worker handler:
 *
 *   import { createDb } from '../src/db/client';
 *   const db = createDb(env.DB);
 *   const rows = await db.select().from(pingChecks).limit(1);
 *
 * We intentionally export a factory rather than a singleton: each Workers
 * invocation receives its own `env`, and the binding instance is per-request.
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

export const createDb = (d1: D1Database) => drizzle(d1, { schema });

export { schema };
