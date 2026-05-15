/**
 * Tests for `upsertOwnerForUser` — the Better Auth → owners bridge added
 * for Issue #15.
 *
 * The function is a Drizzle one-liner (`INSERT ... ON CONFLICT DO NOTHING`),
 * so the interesting behaviour is *what it asks the database to do*, not the
 * SQL it produces (Drizzle's own tests cover that). We fake the minimum
 * surface of the `Database` chain — `insert(table).values(input)
 * .onConflictDoNothing(opts)` — and assert on the captured arguments.
 */

import { describe, expect, it, vi } from 'vitest';
import { type UpsertOwnerInput, upsertOwnerForUser } from '../../../src/auth/ensure-owner';
import { owners } from '../../../src/db/schema';

interface FakeDbCall {
  table: unknown;
  values: unknown;
  conflictTarget: unknown;
}

/**
 * Builds a fake `db` whose `insert(...).values(...).onConflictDoNothing(...)`
 * chain records the arguments and resolves to `undefined`. The shape returned
 * by `onConflictDoNothing` in real Drizzle is a thenable query; the function
 * under test only `await`s it, so resolving a plain Promise is sufficient.
 */
function makeFakeDb(calls: FakeDbCall[]) {
  const insert = vi.fn((table: unknown) => ({
    values: (input: unknown) => ({
      onConflictDoNothing: (opts: unknown) => {
        calls.push({ table, values: input, conflictTarget: opts });
        return Promise.resolve(undefined);
      },
    }),
  }));
  return { insert } as unknown as Parameters<typeof upsertOwnerForUser>[0];
}

const user: UpsertOwnerInput = {
  id: 'user-1',
  email: 'alice@example.com',
};

describe('upsertOwnerForUser', () => {
  it('inserts the row keyed on the Better Auth user id', async () => {
    const calls: FakeDbCall[] = [];
    const db = makeFakeDb(calls);

    await upsertOwnerForUser(db, user);

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe(owners);
    expect(calls[0].values).toEqual({ id: 'user-1', email: 'alice@example.com' });
  });

  it('targets the primary key for conflict resolution (do nothing)', async () => {
    const calls: FakeDbCall[] = [];
    const db = makeFakeDb(calls);

    await upsertOwnerForUser(db, user);

    // The conflict target must be `owners.id` — if it were `owners.email`
    // instead, two users sharing an email (e.g. after a workspace migration)
    // would silently lose history.
    expect(calls[0].conflictTarget).toEqual({ target: owners.id });
  });

  it('is idempotent for repeated calls (the second call still issues the upsert)', async () => {
    // The "idempotency" here is at the SQL level: Drizzle issues the same
    // statement; the database is responsible for the no-op. We assert the
    // function does not short-circuit on the JS side — that would defeat
    // the per-session refresh use case (the row may have been deleted out
    // of band).
    const calls: FakeDbCall[] = [];
    const db = makeFakeDb(calls);

    await upsertOwnerForUser(db, user);
    await upsertOwnerForUser(db, user);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
  });
});
