/**
 * Tests for the `/settings` server-function handlers (Issue #17).
 *
 * We drive the *handlers* directly (not the `createServerFn` wrappers); the
 * same approach as `tests/unit/server/groups.test.ts`. The store is reset
 * between cases via `resetGroupServerStoreForTests` so writes in one `it`
 * never leak into another.
 *
 * Coverage targets:
 *   - getSettingsHandler resolves the path Group (or surfaces `null` for a
 *     foreign / unknown id — Issue #62).
 *   - Mutations cross-check ownership.
 *   - The history-aware delete path surfaces a translated error.
 *   - The default-ruleset guard rejects deletion of the active default.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createGroupHandler } from '../../../src/server/groups';
import { resetGroupServerStoreForTests } from '../../../src/server/groups-store';
import {
  createPlayerHandler,
  createRulesetHandler,
  deactivatePlayerHandler,
  deletePlayerHandler,
  deleteRulesetHandler,
  getSettingsHandler,
  reactivatePlayerHandler,
  renamePlayerHandler,
  setDefaultRulesetHandler,
  updateRulesetHandler,
} from '../../../src/server/settings';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

/**
 * The dev-seed "金曜定例会" Group id for an Owner — the Group the seeded
 * Rulesets / Players live under. `getSettingsHandler` now requires a `groupId`
 * (it comes from the URL path, Issue #62), so the tests anchor on this
 * deterministic id. See `groups-store.ts#seedDevDataIfEmpty`
 * (`g1Id = dev-${ownerId}-friday`).
 */
const seedGroupId = (ownerId: string): string => `dev-${ownerId}-friday`;

/** Resolve the seeded Settings payload, asserting it is not the foreign-id null. */
const loadSettings = async (ownerId: string, groupId = seedGroupId(ownerId)) => {
  const data = await getSettingsHandler({ ownerId, groupId });
  if (data === null) throw new Error('expected the seeded group to resolve');
  return data;
};

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('getSettingsHandler', () => {
  it('returns null for a Group owned by a different Owner', async () => {
    // Seed both owners, then ask as `owner` for `otherOwner`'s group.
    await getSettingsHandler({ ownerId: otherOwner, groupId: seedGroupId(otherOwner) });
    const data = await getSettingsHandler({ ownerId: owner, groupId: seedGroupId(otherOwner) });
    expect(data).toBeNull();
  });

  it('returns null for an unknown Group id', async () => {
    const data = await getSettingsHandler({ ownerId: owner, groupId: 'no-such-group' });
    expect(data).toBeNull();
  });

  it('resolves the Group named in the path', async () => {
    const data = await loadSettings(owner);
    expect(data.group.name).toBe('金曜定例会');
  });

  it('returns the default ruleset flagged on the matching item', async () => {
    const data = await loadSettings(owner);
    const defaults = data.rulesets.filter((r) => r.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.name).toBe('標準ルール');
  });

  it('lists active players first, inactive players last', async () => {
    const data = await loadSettings(owner);
    expect(data.players.length).toBeGreaterThan(0);
    // Seed has 4 active players, no inactive ones; deactivate one and
    // re-fetch to assert the sort.
    const first = data.players[0];
    expect(first).toBeDefined();
    if (!first) return;
    await deactivatePlayerHandler({ ownerId: owner, playerId: first.id });
    const after = await loadSettings(owner);
    const lastIndex = after.players.length - 1;
    expect(after.players[lastIndex]?.id).toBe(first.id);
    expect(after.players[lastIndex]?.isActive).toBe(false);
  });
});

describe('Ruleset mutations', () => {
  it('creates a new ruleset under the active group', async () => {
    const data = await loadSettings(owner);
    const groupId = data.group.id;

    const created = await createRulesetHandler({
      ownerId: owner,
      groupId,
      input: {
        name: '赤あり',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_5_10',
        tobiEnabled: false,
        tobiPoint: null,
      },
    });
    expect(created.name).toBe('赤あり');
    expect(created.isDefault).toBe(false);

    const after = await loadSettings(owner);
    expect(after.rulesets.map((r) => r.name)).toContain('赤あり');
  });

  it('rejects ruleset creation under a group owned by another owner', async () => {
    const mine = await createGroupHandler({ ownerId: owner, name: '自分のG' });
    await expect(
      createRulesetHandler({
        ownerId: otherOwner,
        groupId: mine.id,
        input: {
          name: '不正',
          startingScore: 25000,
          returnScore: 30000,
          umaPattern: 'UMA_10_30',
          tobiEnabled: false,
          tobiPoint: null,
        },
      }),
    ).rejects.toThrow(/not owned/);
  });

  it('translates TobiConfigurationError into a serialisable Error on create', async () => {
    const data = await loadSettings(owner);
    const groupId = data.group.id;
    await expect(
      createRulesetHandler({
        ownerId: owner,
        groupId,
        input: {
          name: '不整合',
          startingScore: 25000,
          returnScore: 30000,
          umaPattern: 'UMA_10_30',
          tobiEnabled: true,
          tobiPoint: null,
        },
      }),
    ).rejects.toThrow(/tobiPoint/);
  });

  it('refuses to delete the current default ruleset', async () => {
    const data = await loadSettings(owner);
    const defaultRuleset = data.rulesets.find((r) => r.isDefault);
    expect(defaultRuleset).toBeDefined();
    if (!defaultRuleset) return;

    await expect(
      deleteRulesetHandler({ ownerId: owner, rulesetId: defaultRuleset.id }),
    ).rejects.toThrow(/default/);
  });

  it('allows deleting a non-default ruleset', async () => {
    const data = await loadSettings(owner);
    const groupId = data.group.id;
    const created = await createRulesetHandler({
      ownerId: owner,
      groupId,
      input: {
        name: '使い捨て',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: false,
        tobiPoint: null,
      },
    });

    const result = await deleteRulesetHandler({ ownerId: owner, rulesetId: created.id });
    expect(result).toEqual({ deleted: true });
  });

  it('changes the group default ruleset', async () => {
    const data = await loadSettings(owner);
    const groupId = data.group.id;
    const created = await createRulesetHandler({
      ownerId: owner,
      groupId,
      input: {
        name: '別ルール',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: false,
        tobiPoint: null,
      },
    });

    const result = await setDefaultRulesetHandler({ ownerId: owner, rulesetId: created.id });
    expect(result).toEqual({ ok: true });

    const after = await loadSettings(owner);
    expect(after.rulesets.find((r) => r.id === created.id)?.isDefault).toBe(true);
    // Only one default at a time.
    expect(after.rulesets.filter((r) => r.isDefault)).toHaveLength(1);
  });

  it('updates an existing ruleset', async () => {
    const data = await loadSettings(owner);
    const target = data.rulesets[0];
    expect(target).toBeDefined();
    if (!target) return;

    const updated = await updateRulesetHandler({
      ownerId: owner,
      rulesetId: target.id,
      input: {
        name: '改名後',
        startingScore: target.startingScore,
        returnScore: target.returnScore,
        umaPattern: target.umaPattern,
        tobiEnabled: target.tobiEnabled,
        tobiPoint: target.tobiPoint,
      },
    });
    expect(updated?.name).toBe('改名後');
  });
});

describe('Player mutations', () => {
  it('creates a new player under the active group', async () => {
    const data = await loadSettings(owner);
    const groupId = data.group.id;

    const created = await createPlayerHandler({ ownerId: owner, groupId, name: '新人' });
    expect(created.name).toBe('新人');
    expect(created.isActive).toBe(true);
    expect(created.hasHistory).toBe(false);

    const after = await loadSettings(owner);
    expect(after.players.map((p) => p.name)).toContain('新人');
  });

  it('renames a player', async () => {
    const data = await loadSettings(owner);
    const target = data.players[0];
    expect(target).toBeDefined();
    if (!target) return;

    const renamed = await renamePlayerHandler({
      ownerId: owner,
      playerId: target.id,
      name: '別名',
    });
    expect(renamed?.name).toBe('別名');
  });

  it('deletes a player without history', async () => {
    const data = await loadSettings(owner);
    const groupId = data.group.id;

    // The seeded roster players carry GameResults (so `hasGameHistory` is now
    // true for them — the in-memory store models GameResult rows since #39).
    // To exercise the delete happy path we add a fresh player, which by
    // definition has no history, then delete it.
    const fresh = await createPlayerHandler({ ownerId: owner, groupId, name: '新メンバー' });

    const result = await deletePlayerHandler({ ownerId: owner, playerId: fresh.id });
    expect(result).toEqual({ deleted: true });
  });

  it('refuses to delete a player who has game history (offers deactivate instead)', async () => {
    // The seeded friday roster players each have a GameResult, so deletion is
    // blocked and the service rethrows a serialisable error the modal turns
    // into the "非アクティブ化" flow.
    const data = await loadSettings(owner);
    const target = data.players.find((p) => p.hasHistory === true);
    expect(target).toBeDefined();
    if (!target) return;

    await expect(deletePlayerHandler({ ownerId: owner, playerId: target.id })).rejects.toThrow(
      /game history/,
    );
  });

  it('toggles a player to inactive and back', async () => {
    const data = await loadSettings(owner);
    const target = data.players[0];
    expect(target).toBeDefined();
    if (!target) return;

    const deactivated = await deactivatePlayerHandler({ ownerId: owner, playerId: target.id });
    expect(deactivated?.isActive).toBe(false);

    const reactivated = await reactivatePlayerHandler({ ownerId: owner, playerId: target.id });
    expect(reactivated?.isActive).toBe(true);
  });

  it('rejects mutations from a different owner', async () => {
    const data = await loadSettings(owner);
    const target = data.players[0];
    expect(target).toBeDefined();
    if (!target) return;

    await expect(
      renamePlayerHandler({
        ownerId: otherOwner,
        playerId: target.id,
        name: '勝手な変更',
      }),
    ).rejects.toThrow(/not owned/);
  });
});
