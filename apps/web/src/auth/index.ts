/**
 * Better Auth bootstrap for the Workers runtime
 * (`docs/docs/05-tech-stack.md` § 認証, `docs/docs/03-user-flow.md` § F1).
 *
 * Scope of this module (per Issue #7 + Issue #15):
 *   - Wire Better Auth's Drizzle adapter to our D1-backed Drizzle client.
 *   - Register Google as the only OAuth provider.
 *   - Disable email/password sign-up (`enabled: false`) — the only path to an
 *     account is via Google OAuth, gated upstream by an invitation token.
 *   - Mount on `/api/auth/*` (Better Auth's default `basePath`).
 *   - Bridge the Better Auth `user` row to a domain `owners` row via
 *     `databaseHooks.user.create.after` + `session.create.after`. This is the
 *     boundary documented in `02-domain-model.md` § Owner: the auth tables
 *     are owned by Better Auth, and every authenticated user must have a
 *     matching `owners` row so the domain side (Group / Player / etc.) can
 *     reference a stable owner id.
 *
 * Out of scope (deliberately deferred to a follow-up issue):
 *   - Real Google OAuth Client ID / Secret values. The Worker reads them from
 *     env vars declared as required; `.dev.vars.example` ships with empty
 *     placeholders so local boot works but real sign-in does not.
 *
 * Why a factory and not a singleton:
 *   The Workers runtime gives each request its own `env` instance, and the
 *   D1 binding is per-request. Better Auth itself caches internal config
 *   between invocations within the same isolate, so the per-request cost of
 *   `betterAuth(...)` is small — and isolation is more important than the
 *   micro-savings.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { accounts, sessions, users, verifications } from '../db/schema';
import { upsertOwnerForUser } from './ensure-owner';

/**
 * Shape of the env bindings that Better Auth needs. The Worker entry imports
 * `AuthEnv` and asserts its own `Env` is assignable to it so any drift gets
 * caught at compile time.
 */
export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  /**
   * Optional in dev — `wrangler dev --local` boots even when these are empty.
   * Real Google sign-in will fail until they are populated; that's by design
   * (Issue #7 explicitly defers acquiring real OAuth credentials).
   */
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  /**
   * Public-facing base URL of the application. Better Auth uses this to
   * build redirect URIs (`{baseURL}/api/auth/callback/google`). For local
   * `wrangler dev` this is `http://localhost:8787`.
   */
  BETTER_AUTH_URL?: string;
}

/**
 * Build a Better Auth instance bound to the request's D1 binding.
 *
 * Adapter notes:
 *   - `provider: 'sqlite'` — D1 speaks SQLite.
 *   - `usePlural: true` — our schema exports `users` / `sessions` / etc.
 *     (the rest of the schema is plural; matching it keeps the codebase
 *     coherent). The drizzle adapter handles the singular/plural model-name
 *     translation in its query layer.
 *   - We pass an explicit `schema` object containing *only* the four tables
 *     Better Auth needs, so the adapter does not accidentally walk the
 *     domain tables (Group, Player, …) looking for an owner FK.
 */
export const createAuth = (env: AuthEnv) => {
  const db = createDb(env.DB);

  return betterAuth({
    appName: 'JANROKU',
    secret: env.BETTER_AUTH_SECRET,
    // Set the base URL only when we have one; Better Auth falls back to
    // `BETTER_AUTH_URL` env reading otherwise. Workers' `env` doesn't expose
    // request-host information at construction time, which is why we accept
    // an explicit value.
    ...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    // Email/password is disabled outright. The only way in is Google OAuth,
    // and we additionally guard signups upstream with an invitation token.
    // `enabled: false` is the supported "turn this whole feature off" knob
    // (see `BetterAuthOptions.emailAndPassword.enabled`).
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        // Plain string is accepted (the array form is for multi-tenant rotations).
        clientId: env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      },
    },
    // Bridge `user` → `owners` (Issue #15 follow-up to #7 / #11).
    //
    // `user.create.after` covers the brand-new sign-up path. The Better Auth
    // `user` row has just been written; we create the matching `owners` row in
    // the same Worker invocation while D1 is still bound. We pass the same
    // `db` instance so the write piggy-backs on the active request.
    //
    // `session.create.after` is the defensive fallback: it runs on every
    // session creation (sign-in *and* refresh), so any pre-existing
    // Better Auth user who signed up before this hook landed still gets an
    // `owners` row materialised on their next login. The upsert is idempotent
    // by primary key (`owners.id = user.id`), so the cost of the redundant
    // write on subsequent logins is exactly one D1 round trip that returns
    // "no change" — acceptable for a per-login event.
    //
    // Why we don't do this from the client (e.g. in `_owner.tsx` `beforeLoad`):
    //   - The browser cannot reach D1; it would need a server function, and
    //     the TanStack Start ↔ Workers integration that would let a server
    //     function see `env.DB` is not yet wired (see `worker/index.ts`).
    //   - Better Auth's hooks already run in the Worker isolate, so this is
    //     the cheapest correct place.
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await upsertOwnerForUser(db, { id: user.id, email: user.email });
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            // Session rows carry `userId` but not the user's email. We fetch
            // the user record (cheap; Better Auth itself just wrote it) and
            // upsert from there. The upsert is keyed on `owners.id = user.id`
            // so duplicate calls are no-ops.
            const [user] = await db
              .select({ id: users.id, email: users.email })
              .from(users)
              .where(eq(users.id, session.userId))
              .limit(1);
            if (!user) return;
            await upsertOwnerForUser(db, user);
          },
        },
      },
    },
    // We don't open the door to additional accidental writes via plugins for
    // MVP; if the invitation-token gate moves into a Better Auth plugin
    // later, it lands here.
    plugins: [],
  });
};

/**
 * Convenience type alias — the auth object exposes `.handler(Request)` and
 * `.api.*` typed endpoints. Re-exporting the inferred type makes downstream
 * imports (`import type { AuthInstance } from '../auth'`) shorter.
 */
export type AuthInstance = ReturnType<typeof createAuth>;
