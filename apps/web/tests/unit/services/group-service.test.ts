/**
 * Tests for the GroupService orchestration / history-aware methods added for
 * S4 (Issue #15). The legacy CRUD passthroughs (findById / listByOwner /
 * create / update / delete) are covered transitively by their repository
 * fakes; this file focuses on the two methods that combine multiple
 * repositories and the new `hasHistory` projection used by the delete-
 * confirmation modal.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { NewGame, UmaPattern } from '../../../src/db/schema';
import {
  DEFAULT_RULESET_NAME,
  DEFAULT_RULESET_RETURN_SCORE,
  DEFAULT_RULESET_STARTING_SCORE,
  DEFAULT_RULESET_UMA_PATTERN,
  GroupHasHistoryError,
  GroupService,
} from '../../../src/services/group-service';
import { FakeGameRepository, FakeGroupRepository, FakeRulesetRepository } from './fakes';

describe('GroupService — legacy constructor (just a GroupRepository)', () => {
  it('preserves the bare-CRUD API used by existing callers', async () => {
    const repo = new FakeGroupRepository();
    const service = new GroupService(repo);

    const created = await service.create({
      id: 'g1',
      ownerId: 'o1',
      name: 'Casual Night',
      defaultRulesetId: null,
    });
    expect(created.name).toBe('Casual Night');

    expect(await service.findById('g1')).not.toBeNull();
    expect(await service.listByOwner('o1')).toHaveLength(1);

    const renamed = await service.update('g1', { name: 'Friday Night' });
    expect(renamed?.name).toBe('Friday Night');

    expect(await service.delete('g1')).toBe(true);
  });

  it('throws when an orchestration method is called without the right deps', async () => {
    const service = new GroupService(new FakeGroupRepository());
    await expect(
      service.createWithDefaultRuleset({ ownerId: 'o1', name: 'X' }),
    ).rejects.toThrowError(/rulesets/);
    await expect(service.hasHistory('g1')).rejects.toThrowError(/games/);
    await expect(service.deleteIfNoHistory('g1')).rejects.toThrowError(/games/);
  });
});

describe('GroupService.createWithDefaultRuleset', () => {
  let groups: FakeGroupRepository;
  let rulesets: FakeRulesetRepository;
  let ids: string[];
  let service: GroupService;

  beforeEach(() => {
    groups = new FakeGroupRepository();
    rulesets = new FakeRulesetRepository();
    // Deterministic id factory: each call to `generateId` consumes the next
    // id. Two calls happen per `createWithDefaultRuleset` (one for the Group,
    // one for the Ruleset) so we seed two values per test where needed.
    ids = ['group-1', 'ruleset-1'];
    service = new GroupService({
      groups,
      rulesets,
      generateId: () => {
        const next = ids.shift();
        if (next === undefined) {
          throw new Error('generateId pool exhausted');
        }
        return next;
      },
    });
  });

  it('creates the Group and its default Ruleset, wiring defaultRulesetId on the Group', async () => {
    const { group, ruleset } = await service.createWithDefaultRuleset({
      ownerId: 'owner-1',
      name: 'Friday Night',
    });

    expect(group.id).toBe('group-1');
    expect(group.ownerId).toBe('owner-1');
    expect(group.name).toBe('Friday Night');
    expect(group.defaultRulesetId).toBe('ruleset-1');

    expect(ruleset.id).toBe('ruleset-1');
    expect(ruleset.groupId).toBe('group-1');
    expect(ruleset.name).toBe(DEFAULT_RULESET_NAME);
    expect(ruleset.startingScore).toBe(DEFAULT_RULESET_STARTING_SCORE);
    expect(ruleset.returnScore).toBe(DEFAULT_RULESET_RETURN_SCORE);

    // Verify the repository state actually reflects the final wiring (the
    // service should return the *updated* Group, not the pre-update copy).
    expect(groups.rows.get('group-1')?.defaultRulesetId).toBe('ruleset-1');
    expect(rulesets.rows.get('ruleset-1')?.groupId).toBe('group-1');
  });

  it('uses the documented default uma pattern (UMA_10_30) for the auto Ruleset', async () => {
    const { ruleset } = await service.createWithDefaultRuleset({
      ownerId: 'owner-1',
      name: 'Group A',
    });
    const expected: UmaPattern = 'UMA_10_30';
    expect(ruleset.umaPattern).toBe(expected);
    expect(DEFAULT_RULESET_UMA_PATTERN).toBe(expected);
  });
});

describe('GroupService — history-aware delete', () => {
  let groups: FakeGroupRepository;
  let games: FakeGameRepository;
  let rulesets: FakeRulesetRepository;
  let service: GroupService;

  const seedGroup = async () => {
    await groups.create({ id: 'g1', ownerId: 'o1', name: 'Group A', defaultRulesetId: null });
  };

  const seedGame = async (groupId: string): Promise<void> => {
    // We don't care about the Ruleset / Match wiring here — only that there
    // is at least one Game row matching `groupId`.
    const input: NewGame = {
      id: `game-${games.rows.size + 1}`,
      groupId,
      matchId: null,
      leagueId: null,
      format: '4P_HANCHAN',
      rulesetId: 'r1',
      playedAt: '2026-05-15T00:00:00.000Z',
    };
    await games.create(input);
  };

  beforeEach(() => {
    groups = new FakeGroupRepository();
    games = new FakeGameRepository();
    rulesets = new FakeRulesetRepository();
    service = new GroupService({ groups, games, rulesets });
  });

  describe('hasHistory', () => {
    it('returns false when the Group has no Games', async () => {
      await seedGroup();
      expect(await service.hasHistory('g1')).toBe(false);
    });

    it('returns true when the Group has at least one Game', async () => {
      await seedGroup();
      await seedGame('g1');
      expect(await service.hasHistory('g1')).toBe(true);
    });
  });

  describe('deleteIfNoHistory', () => {
    it('deletes the Group when it has no Games', async () => {
      await seedGroup();

      const ok = await service.deleteIfNoHistory('g1');
      expect(ok).toBe(true);
      expect(await service.findById('g1')).toBeNull();
    });

    it('throws GroupHasHistoryError when at least one Game is attached', async () => {
      await seedGroup();
      await seedGame('g1');
      await seedGame('g1');

      try {
        await service.deleteIfNoHistory('g1');
        throw new Error('expected GroupHasHistoryError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GroupHasHistoryError);
        const err = error as GroupHasHistoryError;
        expect(err.groupId).toBe('g1');
        expect(err.gameCount).toBe(2);
      }

      // Group must remain in place when deletion is blocked.
      expect(await service.findById('g1')).not.toBeNull();
    });
  });
});
