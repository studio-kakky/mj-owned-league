/**
 * Tests for the `/matches/new` server-function handlers (Issue #20).
 *
 * Shape mirrors `tests/unit/server/leagues.test.ts` — we drive the handler
 * functions directly rather than the `createServerFn` wrappers. The dev
 * seed provides a Group (`金曜定例会`) with an active League / Match and
 * four active Players, which is enough to exercise the happy paths and the
 * ownership / format-mismatch branches.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGroupServerStore,
  resetGroupServerStoreForTests,
} from '../../../src/server/groups-store';
import {
  computeNextSequenceNumber,
  createMatchHandler,
  getMatchCreateContextHandler,
} from '../../../src/server/matches';
import { MemoryMatchRepository } from '../../../src/server/memory-repos';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('getMatchCreateContextHandler', () => {
  it('returns the Owner-scoped Groups / Leagues / Rulesets and pre-aggregates active player counts', async () => {
    const ctx = await getMatchCreateContextHandler({ ownerId: owner });

    expect(ctx.groups.length).toBeGreaterThan(0);
    // Every league surfaced belongs to one of the Owner's Groups.
    const ownedGroupIds = new Set(ctx.groups.map((g) => g.id));
    expect(ctx.leagues.every((l) => ownedGroupIds.has(l.groupId))).toBe(true);
    expect(ctx.rulesets.every((r) => ownedGroupIds.has(r.groupId))).toBe(true);

    // The Friday seed group has 4 active players (たかし / なお / ゆうき / みき).
    const fridayId = ctx.groups.find((g) => g.name === '金曜定例会')?.id;
    expect(fridayId).toBeDefined();
    if (fridayId === undefined) return;
    expect(ctx.activePlayerCountByGroup[fridayId]).toBe(4);

    // The empty seed group has 0 active players.
    const companyId = ctx.groups.find((g) => g.name === '会社の同期会')?.id;
    expect(companyId).toBeDefined();
    if (companyId === undefined) return;
    expect(ctx.activePlayerCountByGroup[companyId]).toBe(0);
  });

  it('pins to the supplied League and auto-allocates the next sequenceNumber', async () => {
    // The dev seed materialises one Match in the spring league with
    // sequenceNumber=1. Pinning the context to that league should preview "2".
    const seeded = await getMatchCreateContextHandler({ ownerId: owner });
    const target = seeded.leagues[0];
    if (!target) throw new Error('expected a seeded league');

    const ctx = await getMatchCreateContextHandler({
      ownerId: owner,
      leagueId: target.id,
    });

    expect(ctx.initialLeagueId).toBe(target.id);
    expect(ctx.initialGroupId).toBe(target.groupId);
    expect(ctx.initialSequenceNumber).toBe(2);
  });

  it('silently drops a foreign leagueId (returns null initial values, not an error)', async () => {
    // Seed the other owner first, then try to pin as `owner`.
    const other = await getMatchCreateContextHandler({ ownerId: otherOwner });
    const foreignLeague = other.leagues[0];
    if (!foreignLeague) throw new Error('expected a seeded league for the other owner');

    const ctx = await getMatchCreateContextHandler({
      ownerId: owner,
      leagueId: foreignLeague.id,
    });

    expect(ctx.initialLeagueId).toBeNull();
    expect(ctx.initialSequenceNumber).toBeNull();
    // Fallback: the first owned group is preselected.
    expect(ctx.initialGroupId).not.toBeNull();
    expect(ctx.groups.find((g) => g.id === ctx.initialGroupId)).toBeDefined();
  });

  it('honours an explicit groupId when supplied and league context is absent', async () => {
    const seeded = await getMatchCreateContextHandler({ ownerId: owner });
    const groupId = seeded.groups[seeded.groups.length - 1]?.id;
    if (!groupId) throw new Error('expected at least one seeded group');

    const ctx = await getMatchCreateContextHandler({ ownerId: owner, groupId });
    expect(ctx.initialGroupId).toBe(groupId);
    expect(ctx.initialLeagueId).toBeNull();
  });
});

describe('createMatchHandler', () => {
  it('persists a Match under a League and auto-numbers it', async () => {
    const seeded = await getMatchCreateContextHandler({ ownerId: owner });
    const targetLeague = seeded.leagues[0];
    if (!targetLeague) throw new Error('expected a seeded league');

    const created = await createMatchHandler({
      ownerId: owner,
      groupId: targetLeague.groupId,
      leagueId: targetLeague.id,
      name: '第 2 節',
      heldAt: '2026-05-15',
      memo: 'テスト用',
      defaultRulesetId: null,
    });

    expect(created.name).toBe('第 2 節');
    expect(created.leagueId).toBe(targetLeague.id);
    expect(created.groupId).toBe(targetLeague.groupId);
    // The seed already created sequenceNumber=1, so this one should be 2.
    expect(created.sequenceNumber).toBe(2);
  });

  it('persists a League-less Match (cross-group) with sequenceNumber=null', async () => {
    const seeded = await getMatchCreateContextHandler({ ownerId: owner });
    const ownGroup = seeded.groups[0];
    if (!ownGroup) throw new Error('expected a seeded group');

    const created = await createMatchHandler({
      ownerId: owner,
      groupId: ownGroup.id,
      leagueId: null,
      name: 'カジュアル対局',
      heldAt: null,
      memo: null,
      defaultRulesetId: null,
    });

    expect(created.leagueId).toBeNull();
    expect(created.sequenceNumber).toBeNull();
  });

  it('rejects creation when the Group belongs to a different Owner', async () => {
    const other = await getMatchCreateContextHandler({ ownerId: otherOwner });
    const foreignGroup = other.groups[0];
    if (!foreignGroup) throw new Error('expected a foreign group');

    await expect(
      createMatchHandler({
        ownerId: owner,
        groupId: foreignGroup.id,
        leagueId: null,
        name: 'cross-owner attempt',
        heldAt: null,
        memo: null,
        defaultRulesetId: null,
      }),
    ).rejects.toThrow(/not owned/);
  });

  it('rejects a leagueId that does not belong to the chosen Group', async () => {
    const seeded = await getMatchCreateContextHandler({ ownerId: owner });
    const otherGroup = seeded.groups.find((g) => g.name === '会社の同期会');
    const targetLeague = seeded.leagues[0];
    if (!otherGroup || !targetLeague) throw new Error('expected two distinct seeded groups');

    await expect(
      createMatchHandler({
        ownerId: owner,
        groupId: otherGroup.id,
        leagueId: targetLeague.id,
        name: 'cross-group league',
        heldAt: null,
        memo: null,
        defaultRulesetId: null,
      }),
    ).rejects.toThrow(/League/);
  });

  it('rejects a defaultRulesetId that does not belong to the chosen Group', async () => {
    const seeded = await getMatchCreateContextHandler({ ownerId: owner });
    const ownGroup = seeded.groups[0];
    if (!ownGroup) throw new Error('expected a seeded group');
    const foreignRuleset = seeded.rulesets.find((r) => r.groupId !== ownGroup.id);
    if (!foreignRuleset) throw new Error('expected a foreign ruleset in the seed');

    await expect(
      createMatchHandler({
        ownerId: owner,
        groupId: ownGroup.id,
        leagueId: null,
        name: 'wrong ruleset',
        heldAt: null,
        memo: null,
        defaultRulesetId: foreignRuleset.id,
      }),
    ).rejects.toThrow(/Ruleset/);
  });
});

describe('computeNextSequenceNumber', () => {
  it('returns 1 for a League with no Matches', async () => {
    // Reset, materialise the seed, then point at a League whose Matches we
    // wipe out for this test.
    await getMatchCreateContextHandler({ ownerId: owner });
    const store = getGroupServerStore();
    const league = [...store.leagues.values()][0];
    if (!league) throw new Error('expected a seeded league');
    // Drop every Match attached to it.
    for (const m of [...store.matches.values()]) {
      if (m.leagueId === league.id) store.matches.delete(m.id);
    }
    const matches = new MemoryMatchRepository(store);
    expect(await computeNextSequenceNumber(matches, league.id)).toBe(1);
  });

  it('returns max + 1 when the League has existing numbered Matches', async () => {
    await getMatchCreateContextHandler({ ownerId: owner });
    const store = getGroupServerStore();
    const league = [...store.leagues.values()][0];
    if (!league) throw new Error('expected a seeded league');
    // Seed already has sequenceNumber=1; verify we land on 2.
    const matches = new MemoryMatchRepository(store);
    expect(await computeNextSequenceNumber(matches, league.id)).toBe(2);
  });
});
