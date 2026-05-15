/**
 * Tests for the `/groups` server-function handlers (Issue #15).
 *
 * We exercise the *handlers* (`listGroupsHandler` etc.) directly rather than
 * the `createServerFn` wrappers — those are thin adapters that only forward
 * `data` into the handler and need the TanStack Start compiler to be
 * meaningfully invokable. The handlers carry the actual logic: ownership
 * filtering, projection to `GroupListItem`, history-aware delete.
 *
 * Each test resets the module-level store via `resetGroupServerStoreForTests`
 * so we don't see leakage from one `it` to the next.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createGroupHandler,
  deleteGroupHandler,
  listGroupsHandler,
  renameGroupHandler,
} from '../../../src/server/groups';
import { resetGroupServerStoreForTests } from '../../../src/server/groups-store';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('listGroupsHandler', () => {
  it('materialises the dev seed on first call and returns both seeded groups for the owner', async () => {
    const items = await listGroupsHandler({ ownerId: owner });

    expect(items).toHaveLength(2);
    const byName = new Map(items.map((i) => [i.name, i]));
    expect(byName.get('金曜定例会')?.hasHistory).toBe(true);
    expect(byName.get('会社の同期会')?.hasHistory).toBe(false);
  });

  it('isolates seed materialisation by ownerId', async () => {
    await listGroupsHandler({ ownerId: owner });
    const other = await listGroupsHandler({ ownerId: otherOwner });
    // The other owner sees their own seed, not the first owner's groups.
    expect(other).toHaveLength(2);
    expect(other.every((g) => g.id.startsWith(`dev-${otherOwner}-`))).toBe(true);
  });

  it('projects lastPlayedAt from the most recent Game (seeded fixture)', async () => {
    const items = await listGroupsHandler({ ownerId: owner });
    const friday = items.find((i) => i.name === '金曜定例会');
    expect(friday?.lastPlayedAt).toBe('2026-05-08T00:00:00.000Z');
  });
});

describe('createGroupHandler', () => {
  it('creates a new Group with the default Ruleset and returns its projection', async () => {
    const created = await createGroupHandler({ ownerId: owner, name: '新規グループ' });

    expect(created.name).toBe('新規グループ');
    expect(created.hasHistory).toBe(false);
    expect(created.lastPlayedAt).toBeNull();

    // The list reflects the new Group (plus the dev seed for this owner —
    // listGroupsHandler materialises the seed on its own first call).
    const items = await listGroupsHandler({ ownerId: owner });
    expect(items.map((i) => i.name)).toContain('新規グループ');
  });
});

describe('renameGroupHandler', () => {
  it('renames a Group owned by the caller', async () => {
    const created = await createGroupHandler({ ownerId: owner, name: '旧名' });

    const renamed = await renameGroupHandler({
      ownerId: owner,
      groupId: created.id,
      name: '新名',
    });

    expect(renamed).not.toBeNull();
    expect(renamed?.name).toBe('新名');

    const items = await listGroupsHandler({ ownerId: owner });
    expect(items.find((i) => i.id === created.id)?.name).toBe('新名');
  });

  it('returns null when the Group belongs to a different owner', async () => {
    const created = await createGroupHandler({ ownerId: owner, name: 'A' });

    const renamed = await renameGroupHandler({
      ownerId: otherOwner,
      groupId: created.id,
      name: '不正なリネーム',
    });

    expect(renamed).toBeNull();
    // The original Group's name is preserved.
    const items = await listGroupsHandler({ ownerId: owner });
    expect(items.find((i) => i.id === created.id)?.name).toBe('A');
  });

  it('returns null when the Group does not exist', async () => {
    const result = await renameGroupHandler({
      ownerId: owner,
      groupId: 'does-not-exist',
      name: 'anything',
    });
    expect(result).toBeNull();
  });
});

describe('deleteGroupHandler', () => {
  it('deletes a Group with no Games', async () => {
    const created = await createGroupHandler({ ownerId: owner, name: 'Disposable' });

    const result = await deleteGroupHandler({ ownerId: owner, groupId: created.id });
    expect(result).toEqual({ deleted: true });

    // The Group disappears from the list.
    const items = await listGroupsHandler({ ownerId: owner });
    expect(items.find((i) => i.id === created.id)).toBeUndefined();
  });

  it('throws when the target Group has Game history', async () => {
    // The seeded 金曜定例会 has a Game; using it lets us avoid building a
    // Game by hand for this test.
    const items = await listGroupsHandler({ ownerId: owner });
    const withHistory = items.find((i) => i.hasHistory === true);
    expect(withHistory).toBeDefined();

    await expect(
      deleteGroupHandler({ ownerId: owner, groupId: withHistory?.id ?? '' }),
    ).rejects.toThrow(/has \d+ game/);
  });

  it('returns { deleted: false } when the Group belongs to a different owner', async () => {
    const created = await createGroupHandler({ ownerId: owner, name: 'Mine' });

    const result = await deleteGroupHandler({ ownerId: otherOwner, groupId: created.id });
    expect(result).toEqual({ deleted: false });

    // The original Group still exists.
    const items = await listGroupsHandler({ ownerId: owner });
    expect(items.find((i) => i.id === created.id)).toBeDefined();
  });
});
