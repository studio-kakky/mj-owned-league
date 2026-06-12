/**
 * Tests for the active-group server-function handlers (Issue #58).
 *
 * We drive the *handlers* (`getActiveGroupHandler` / `setActiveGroupHandler`)
 * directly rather than the `createServerFn` wrappers — those are thin adapters
 * that only resolve `ownerId` from the session and forward into the handler.
 * The handlers carry the real logic: ownership verification on set, and the
 * persisted read on get.
 *
 * Each test resets the module-level store so we don't see leakage between
 * cases. `seedDevDataIfEmpty` (invoked inside the handlers in memory mode)
 * materialises one Owner row plus two Groups per owner; the Group with the
 * `-company` suffix is the empty / deletable one we use as the select target.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { getActiveGroupHandler, setActiveGroupHandler } from '../../../src/server/active-group';
import { createGroupHandler, listGroupsHandler } from '../../../src/server/groups';
import { resetGroupServerStoreForTests } from '../../../src/server/groups-store';

const owner = 'owner-active-1';
const otherOwner = 'owner-active-2';

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('getActiveGroupHandler', () => {
  it('returns null for a freshly-seeded owner (no group selected yet)', async () => {
    const active = await getActiveGroupHandler({ ownerId: owner });
    expect(active).toBeNull();
  });
});

describe('setActiveGroupHandler', () => {
  it('persists the active group for a group the owner owns', async () => {
    // Create a group the owner owns, then select it.
    const created = await createGroupHandler({ ownerId: owner, name: 'マイグループ' });

    const result = await setActiveGroupHandler({ ownerId: owner, groupId: created.id });
    expect(result).toEqual({ ok: true, groupId: created.id });

    // The persisted value is readable back through get.
    const active = await getActiveGroupHandler({ ownerId: owner });
    expect(active).toBe(created.id);
  });

  it('rejects selecting a group owned by a different owner', async () => {
    // `otherOwner` creates a group; `owner` must not be able to select it.
    const foreign = await createGroupHandler({ ownerId: otherOwner, name: '他人のグループ' });

    const result = await setActiveGroupHandler({ ownerId: owner, groupId: foreign.id });
    expect(result).toEqual({ ok: false });

    // Nothing was persisted on the caller's owner row.
    const active = await getActiveGroupHandler({ ownerId: owner });
    expect(active).toBeNull();
  });

  it('rejects selecting a group that does not exist', async () => {
    const result = await setActiveGroupHandler({
      ownerId: owner,
      groupId: 'no-such-group',
    });
    expect(result).toEqual({ ok: false });
  });

  it('overwrites a previous selection', async () => {
    const first = await createGroupHandler({ ownerId: owner, name: '一番目' });
    const second = await createGroupHandler({ ownerId: owner, name: '二番目' });

    await setActiveGroupHandler({ ownerId: owner, groupId: first.id });
    await setActiveGroupHandler({ ownerId: owner, groupId: second.id });

    expect(await getActiveGroupHandler({ ownerId: owner })).toBe(second.id);
  });

  it('keeps selections isolated per owner', async () => {
    const ownerGroup = await createGroupHandler({ ownerId: owner, name: '自分の' });
    const otherGroup = await createGroupHandler({ ownerId: otherOwner, name: '相手の' });

    await setActiveGroupHandler({ ownerId: owner, groupId: ownerGroup.id });
    await setActiveGroupHandler({ ownerId: otherOwner, groupId: otherGroup.id });

    expect(await getActiveGroupHandler({ ownerId: owner })).toBe(ownerGroup.id);
    expect(await getActiveGroupHandler({ ownerId: otherOwner })).toBe(otherGroup.id);
  });

  it('seeds at least one selectable group via listGroups for the owner', async () => {
    // Sanity: the dev seed gives every owner a couple of groups to choose from,
    // and selecting one of those seeded groups works end to end.
    const groups = await listGroupsHandler({ ownerId: owner });
    expect(groups.length).toBeGreaterThan(0);

    const target = groups[0];
    if (target === undefined) throw new Error('expected a seeded group');
    const result = await setActiveGroupHandler({ ownerId: owner, groupId: target.id });
    expect(result).toEqual({ ok: true, groupId: target.id });
    expect(await getActiveGroupHandler({ ownerId: owner })).toBe(target.id);
  });
});
