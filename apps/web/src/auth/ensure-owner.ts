/**
 * `upsertOwnerForUser` — idempotent bridge from Better Auth `user` to the
 * domain `owners` row (Issue #15 follow-up).
 *
 * Why this lives in `src/auth/` and not in `src/services/`:
 *   The bridging logic is part of the auth boundary — it only runs when
 *   Better Auth fires its `user.create.after` / `session.create.after` hooks
 *   inside the Worker. `OwnerService` (in `src/services/`) is the
 *   storage-agnostic CRUD API for owners; it would be wrong to bake an
 *   auth-shaped "upsert by user id" method into that surface. Keeping the
 *   helper next to `createAuth` makes the dependency direction obvious.
 *
 * Idempotency model:
 *   `owners.id` is set to `user.id`. The primary-key constraint on `owners.id`
 *   guarantees we cannot create a second row for the same user. We use
 *   `INSERT ... ON CONFLICT (id) DO UPDATE` so:
 *     - First sign-in: insert succeeds, row materialises.
 *     - Subsequent sign-ins: the `DO UPDATE` keeps the email in sync (rare —
 *       Google rarely changes the address — but cheap and correct).
 *     - Concurrent first sign-ins (impossible in practice for a single user,
 *       but worth describing): both racing writes still converge on the same
 *       row.
 *
 * Email reconciliation:
 *   `owners.email` carries a `UNIQUE` constraint. We deliberately do NOT
 *   overwrite the email on conflict, because Google addresses very rarely
 *   change and an overwrite could collide with a *different* existing
 *   `owners` row that already holds the new email. The first sign-in writes
 *   the email; later sign-ins are no-ops at the row level. If real
 *   email-migration handling becomes necessary, it lands as its own service
 *   method, not in this hot path.
 */

import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { owners } from '../db/schema';

export interface UpsertOwnerInput {
  id: string;
  email: string;
}

/**
 * Inserts the `owners` row whose primary key matches `user.id` if it does
 * not already exist. A no-op when the row is already there.
 *
 * Uses `onConflictDoNothing` so we get the entire upsert in a single round
 * trip — SELECT-then-INSERT would race and double the cost in the common
 * "already exists" path on session refresh.
 */
export async function upsertOwnerForUser(db: Database, user: UpsertOwnerInput): Promise<void> {
  await db
    .insert(owners)
    .values({ id: user.id, email: user.email })
    .onConflictDoNothing({ target: owners.id });
}

/**
 * Convenience read used by tests / by future server functions that want to
 * confirm an owner row exists for the current session. Returns `null` when
 * no row matches — callers can decide whether that should be a 401 / 500 / etc.
 */
export async function findOwnerById(
  db: Database,
  id: string,
): Promise<{ id: string; email: string } | null> {
  const rows = await db
    .select({ id: owners.id, email: owners.email })
    .from(owners)
    .where(eq(owners.id, id))
    .limit(1);
  return rows[0] ?? null;
}
