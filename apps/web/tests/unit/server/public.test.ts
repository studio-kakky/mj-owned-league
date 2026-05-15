/**
 * Tests for the P1-P4 public viewer server handlers (Issue #23).
 *
 * We drive the handler functions directly (not the `createServerFn`
 * wrappers) so the tests do not need the RPC compiler bundled. The seed
 * (`seedDevDataIfEmpty`) provides one League ("2026 春シーズン") with one
 * Match ("第 1 節") and four GameResult rows; that is enough to exercise
 * every projection branch except the cross-Group leak guard, which we
 * synthesise inline.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGroupServerStore,
  resetGroupServerStoreForTests,
} from '../../../src/server/groups-store';
import { listLeaguesHandler } from '../../../src/server/leagues';
import {
  getPublicLeagueHandler,
  getPublicLeagueMatchHandler,
  getPublicMatchHandler,
  getPublicPlayerHandler,
} from '../../../src/server/public';

const owner = 'owner-public-test-1';

beforeEach(() => {
  resetGroupServerStoreForTests();
});

async function ensureSeed(): Promise<{ publicSlug: string }> {
  await listLeaguesHandler({ ownerId: owner });
  const store = getGroupServerStore();
  const league = [...store.leagues.values()].find((l) => l.name === '2026 春シーズン');
  if (!league) throw new Error('expected seeded league');
  return { publicSlug: league.publicSlug };
}

describe('getPublicLeagueHandler', () => {
  it('returns the projected payload for a known slug', async () => {
    const { publicSlug } = await ensureSeed();

    const data = await getPublicLeagueHandler({ publicSlug });
    expect(data).not.toBeNull();
    expect(data?.name).toBe('2026 春シーズン');
    expect(data?.format).toBe('4P_HANCHAN');
    expect(data?.groupName).toBe('金曜定例会');
    expect(data?.defaultRuleset?.name).toBeDefined();
    expect(data?.matches).toHaveLength(1);
    expect(data?.matches[0]?.sequenceNumber).toBe(1);
    expect(data?.ranking).toHaveLength(4);
    // たかし is the seeded 1st-place (points = 65); rank order ⇒ first row.
    expect(data?.ranking[0]?.playerName).toBe('たかし');
    expect(data?.ranking[0]?.totalPoints).toBeCloseTo(65, 5);
    expect(data?.ranking[0]?.topCount).toBe(1);
    expect(data?.ranking[0]?.topRate).toBeCloseTo(1, 5);
    expect(data?.ranking[0]?.averageRank).toBeCloseTo(1, 5);
    expect(data?.ranking.at(-1)?.playerName).toBe('みき');
    expect(data?.ranking.at(-1)?.lastCount).toBe(1);
  });

  it('returns null for an unknown slug', async () => {
    await ensureSeed();
    const data = await getPublicLeagueHandler({ publicSlug: 'does-not-exist' });
    expect(data).toBeNull();
  });

  it('omits matches without a sequenceNumber from the list', async () => {
    const { publicSlug } = await ensureSeed();
    const store = getGroupServerStore();
    // Synthesise a sibling Match that has no sequenceNumber.
    const league = [...store.leagues.values()].find((l) => l.publicSlug === publicSlug);
    if (!league) throw new Error('league disappeared');
    store.matches.set('m-unnumbered', {
      id: 'm-unnumbered',
      groupId: league.groupId,
      leagueId: league.id,
      name: '番外編',
      sequenceNumber: null,
      heldAt: null,
      memo: null,
      defaultRulesetId: null,
      createdAt: new Date().toISOString(),
    });

    const data = await getPublicLeagueHandler({ publicSlug });
    expect(data?.matches.find((m) => m.name === '番外編')).toBeUndefined();
  });
});

describe('getPublicLeagueMatchHandler', () => {
  it('returns the projected payload for a known (slug, sequenceNumber) pair', async () => {
    const { publicSlug } = await ensureSeed();

    const data = await getPublicLeagueMatchHandler({ publicSlug, sequenceNumber: 1 });
    expect(data).not.toBeNull();
    expect(data?.name).toBe('第 1 節');
    expect(data?.sequenceNumber).toBe(1);
    expect(data?.leagueName).toBe('2026 春シーズン');
    expect(data?.leaguePublicSlug).toBe(publicSlug);
    expect(data?.games).toHaveLength(1);
    expect(data?.games[0]?.results).toHaveLength(4);
    // results sorted by rank asc.
    expect(data?.games[0]?.results.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(data?.ranking[0]?.playerName).toBe('たかし');
  });

  it('returns null for a missing sequenceNumber', async () => {
    const { publicSlug } = await ensureSeed();
    const data = await getPublicLeagueMatchHandler({ publicSlug, sequenceNumber: 99 });
    expect(data).toBeNull();
  });

  it('returns null for an unknown slug', async () => {
    await ensureSeed();
    const data = await getPublicLeagueMatchHandler({
      publicSlug: 'nope',
      sequenceNumber: 1,
    });
    expect(data).toBeNull();
  });
});

describe('getPublicMatchHandler', () => {
  it('always returns null in MVP (no Match-level publicSlug yet)', async () => {
    await ensureSeed();
    const data = await getPublicMatchHandler({ publicSlug: 'whatever' });
    expect(data).toBeNull();
  });
});

describe('getPublicPlayerHandler', () => {
  it('returns aggregate metrics and per-Match rows for a known player', async () => {
    const { publicSlug } = await ensureSeed();
    const store = getGroupServerStore();
    const player = [...store.players.values()].find((p) => p.name === 'たかし');
    if (!player) throw new Error('expected seeded player');

    const data = await getPublicPlayerHandler({ publicSlug, playerId: player.id });
    expect(data).not.toBeNull();
    expect(data?.playerName).toBe('たかし');
    expect(data?.summary.gameCount).toBe(1);
    expect(data?.summary.totalPoints).toBeCloseTo(65, 5);
    expect(data?.summary.topCount).toBe(1);
    expect(data?.summary.lastCount).toBe(0);
    expect(data?.summary.averageRank).toBeCloseTo(1, 5);
    expect(data?.summary.topRate).toBeCloseTo(1, 5);
    expect(data?.matches).toHaveLength(1);
    expect(data?.matches[0]?.gameCount).toBe(1);
    expect(data?.games).toHaveLength(1);
    expect(data?.games[0]?.rank).toBe(1);
  });

  it('returns zeroed-out metrics for a player who has not played yet', async () => {
    const { publicSlug } = await ensureSeed();
    const store = getGroupServerStore();
    const league = [...store.leagues.values()].find((l) => l.publicSlug === publicSlug);
    if (!league) throw new Error('league disappeared');
    // Add a fresh active player with no GameResult rows.
    const player = {
      id: 'player-fresh',
      groupId: league.groupId,
      name: '新人',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    store.players.set(player.id, player);

    const data = await getPublicPlayerHandler({ publicSlug, playerId: player.id });
    expect(data).not.toBeNull();
    expect(data?.summary.gameCount).toBe(0);
    expect(data?.summary.averagePoints).toBe(0);
    expect(data?.summary.topRate).toBe(0);
    expect(data?.summary.averageRank).toBe(0);
    expect(data?.games).toHaveLength(0);
    // The Match list still surfaces every Match in the League, with
    // zero-aggregates per Match for this player.
    expect(data?.matches).toHaveLength(1);
    expect(data?.matches[0]?.gameCount).toBe(0);
  });

  it('returns null when the playerId belongs to a different Group', async () => {
    const { publicSlug } = await ensureSeed();
    const store = getGroupServerStore();
    // Synthesise a player in a sibling Group of a different Owner.
    const foreignGroupId = 'g-foreign';
    const foreignOwner = 'owner-foreign';
    store.groups.set(foreignGroupId, {
      id: foreignGroupId,
      ownerId: foreignOwner,
      name: '別グループ',
      defaultRulesetId: null,
      createdAt: new Date().toISOString(),
    });
    const foreignPlayerId = 'foreign-player';
    store.players.set(foreignPlayerId, {
      id: foreignPlayerId,
      groupId: foreignGroupId,
      name: 'よその人',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    const data = await getPublicPlayerHandler({ publicSlug, playerId: foreignPlayerId });
    expect(data).toBeNull();
  });
});
