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

/**
 * Deterministic dev-seed Group ids (see
 * `groups-store.ts#seedDevDataIfEmpty`). `getMatchCreateContextHandler` now
 * requires a `groupId` from the URL path (Issue #61), so the tests anchor on
 * these ids rather than enumerating Groups.
 */
const fridayGroupId = (ownerId: string): string => `dev-${ownerId}-friday`;
const companyGroupId = (ownerId: string): string => `dev-${ownerId}-company`;

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('getMatchCreateContextHandler', () => {
  it('returns the scoped Group / its Leagues / Rulesets and pre-aggregates active player counts', async () => {
    const ctx = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
    });
    if (ctx === null) throw new Error('expected the seeded group to resolve');

    // The context collapses to the single scoped Group.
    expect(ctx.groups).toHaveLength(1);
    expect(ctx.groups[0]?.name).toBe('金曜定例会');
    // Every league / ruleset surfaced belongs to the scoped Group.
    expect(ctx.leagues.every((l) => l.groupId === fridayGroupId(owner))).toBe(true);
    expect(ctx.rulesets.every((r) => r.groupId === fridayGroupId(owner))).toBe(true);

    // The Friday seed group has 4 active players (たかし / なお / ゆうき / みき).
    expect(ctx.activePlayerCountByGroup[fridayGroupId(owner)]).toBe(4);

    // The empty seed group has 0 active players when scoped to it.
    const empty = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: companyGroupId(owner),
    });
    if (empty === null) throw new Error('expected the empty group to resolve');
    expect(empty.activePlayerCountByGroup[companyGroupId(owner)]).toBe(0);
  });

  it('returns null for a Group owned by a different Owner', async () => {
    await getMatchCreateContextHandler({ ownerId: otherOwner, groupId: fridayGroupId(otherOwner) });
    const ctx = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(otherOwner),
    });
    expect(ctx).toBeNull();
  });

  it('pins to the supplied League and auto-allocates the next sequenceNumber', async () => {
    // The dev seed materialises one Match in the spring league with
    // sequenceNumber=1. Pinning the context to that league should preview "2".
    const seeded = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
    });
    if (seeded === null) throw new Error('expected the seeded group to resolve');
    const target = seeded.leagues[0];
    if (!target) throw new Error('expected a seeded league');

    const ctx = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      leagueId: target.id,
    });
    if (ctx === null) throw new Error('expected the seeded group to resolve');

    expect(ctx.initialLeagueId).toBe(target.id);
    expect(ctx.initialGroupId).toBe(target.groupId);
    expect(ctx.initialSequenceNumber).toBe(2);
  });

  it('silently drops a leagueId outside the scoped Group (returns null initial League, not an error)', async () => {
    // Seed the other owner first, then try to pin its League under `owner`'s
    // Group context.
    const other = await getMatchCreateContextHandler({
      ownerId: otherOwner,
      groupId: fridayGroupId(otherOwner),
    });
    if (other === null) throw new Error('expected the other owner s group to resolve');
    const foreignLeague = other.leagues[0];
    if (!foreignLeague) throw new Error('expected a seeded league for the other owner');

    const ctx = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      leagueId: foreignLeague.id,
    });
    if (ctx === null) throw new Error('expected the seeded group to resolve');

    expect(ctx.initialLeagueId).toBeNull();
    expect(ctx.initialSequenceNumber).toBeNull();
    // The Group selection stays pinned to the path Group.
    expect(ctx.initialGroupId).toBe(fridayGroupId(owner));
  });
});

describe('createMatchHandler', () => {
  it('persists a Match under a League and auto-numbers it', async () => {
    const seeded = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
    });
    if (seeded === null) throw new Error('expected the seeded group to resolve');
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

  it('persists a League-less Match with sequenceNumber=null', async () => {
    const seeded = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
    });
    if (seeded === null) throw new Error('expected the seeded group to resolve');
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
    // Materialise the other owner's seed, then attempt to create under their
    // Group as `owner`.
    await getMatchCreateContextHandler({ ownerId: otherOwner, groupId: fridayGroupId(otherOwner) });

    await expect(
      createMatchHandler({
        ownerId: owner,
        groupId: fridayGroupId(otherOwner),
        leagueId: null,
        name: 'cross-owner attempt',
        heldAt: null,
        memo: null,
        defaultRulesetId: null,
      }),
    ).rejects.toThrow(/not owned/);
  });

  it('rejects a leagueId that does not belong to the chosen Group', async () => {
    // The spring League lives under the Friday Group; pairing it with the
    // empty Company Group must be rejected.
    const seeded = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
    });
    if (seeded === null) throw new Error('expected the seeded group to resolve');
    const targetLeague = seeded.leagues[0];
    if (!targetLeague) throw new Error('expected a seeded league');

    await expect(
      createMatchHandler({
        ownerId: owner,
        groupId: companyGroupId(owner),
        leagueId: targetLeague.id,
        name: 'cross-group league',
        heldAt: null,
        memo: null,
        defaultRulesetId: null,
      }),
    ).rejects.toThrow(/League/);
  });

  it('rejects a defaultRulesetId that does not belong to the chosen Group', async () => {
    // A Ruleset from the Friday Group must be rejected when creating under the
    // Company Group.
    const friday = await getMatchCreateContextHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
    });
    if (friday === null) throw new Error('expected the seeded group to resolve');
    const fridayRuleset = friday.rulesets[0];
    if (!fridayRuleset) throw new Error('expected a ruleset in the Friday seed');

    await expect(
      createMatchHandler({
        ownerId: owner,
        groupId: companyGroupId(owner),
        leagueId: null,
        name: 'wrong ruleset',
        heldAt: null,
        memo: null,
        defaultRulesetId: fridayRuleset.id,
      }),
    ).rejects.toThrow(/Ruleset/);
  });
});

describe('computeNextSequenceNumber', () => {
  it('returns 1 for a League with no Matches', async () => {
    // Reset, materialise the seed, then point at a League whose Matches we
    // wipe out for this test.
    await getMatchCreateContextHandler({ ownerId: owner, groupId: fridayGroupId(owner) });
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
    await getMatchCreateContextHandler({ ownerId: owner, groupId: fridayGroupId(owner) });
    const store = getGroupServerStore();
    const league = [...store.leagues.values()][0];
    if (!league) throw new Error('expected a seeded league');
    // Seed already has sequenceNumber=1; verify we land on 2.
    const matches = new MemoryMatchRepository(store);
    expect(await computeNextSequenceNumber(matches, league.id)).toBe(2);
  });
});
