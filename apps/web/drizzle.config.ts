/**
 * drizzle-kit configuration for the Cloudflare D1 database.
 *
 * Workflow:
 *   1. `pnpm --filter web drizzle:generate`
 *      → drizzle-kit reads `src/db/schema.ts` and emits SQL migrations into
 *        `drizzle/` (this directory is committed).
 *
 *   2. `pnpm --filter web drizzle:apply:local`
 *      → applies the migrations to the local Miniflare-backed D1 (under
 *        `.wrangler/state`). This is what you want during development and
 *        when running the round-trip smoke test via `worker:dev`.
 *
 *   3. `pnpm --filter web drizzle:apply:remote`
 *      → applies the migrations to the real D1 database. This will only work
 *        once a real `database_id` is set in `wrangler.toml` (follow-up to
 *        issue #5; tracked in the root README's "TODO" list).
 *
 * The `dialect: 'sqlite'` + `driver: 'd1-http'` combination is the official
 * drizzle-kit setup for D1. We do not set HTTP credentials in this config
 * because the migrations are always *generated* offline and *applied* via
 * `wrangler d1 migrations apply`, which uses the wrangler auth chain.
 *
 * See: https://orm.drizzle.team/docs/connect-cloudflare-d1
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  // Drizzle-kit only consults these fields when running commands that need
  // to hit the D1 HTTP API directly (e.g. `drizzle-kit push`, `studio`).
  // Our flow uses `wrangler d1 migrations apply`, so the values below are
  // intentionally placeholders. They are read from the environment to keep
  // the config file free of secrets, and `?? ''` is used so that the more
  // common offline `generate` command still works without env vars set.
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? '',
    token: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
  // Keep generated SQL grouped by feature for readability later on.
  verbose: true,
  strict: true,
});
