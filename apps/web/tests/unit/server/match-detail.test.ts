/**
 * Tests for the S9 / S11-S13 match-detail server handlers (Issue #19).
 *
 * Mirrors `tests/unit/server/matches.test.ts`: we drive the handler functions
 * directly rather than the `createServerFn` wrappers. The dev seed provides
 * one Match with four GameResult rows (たかし / なお / ゆうき / みき), so
 * the "load detail + recompute on edit" paths are exercisable without extra
 * fixtures.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  gameResultKey,
  getGroupServerStore,
  resetGroupServerStoreForTests,
} from '../../../src/server/groups-store';
import {
  deleteGameHandler,
  getMatchDetailHandler,
  listMatchesHandler,
  submitGameHandler,
} from '../../../src/server/match-detail';
import { getMatchCreateContextHandler } from '../../../src/server/matches';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

/**
 * Deterministic dev-seed Friday Group id for an Owner (see
 * `groups-store.ts#seedDevDataIfEmpty`). The Match handlers now require a
 * `groupId` from the URL path (Issue #61); the seeded Match / League / Players
 * all live under this Group.
 */
const fridayGroupId = (ownerId: string): string => `dev-${ownerId}-friday`;

/**
 * Materialises the dev seed for an Owner via the Friday-scoped context call and
 * returns that context (Leagues / Rulesets for the scoped Group).
 */
const seedFor = async (ownerId: string) => {
  const ctx = await getMatchCreateContextHandler({ ownerId, groupId: fridayGroupId(ownerId) });
  if (ctx === null) throw new Error('expected the seeded Friday group to resolve');
  return ctx;
};

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('getMatchDetailHandler', () => {
  it('returns the projected payload with ranking computed from GameResult', async () => {
    // Materialise the seed.
    await seedFor(owner);
    const store = getGroupServerStore();
    const match = [...store.matches.values()].find((m) => m.name === '第 1 節');
    if (!match) throw new Error('expected seeded match');

    const detail = await getMatchDetailHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      matchId: match.id,
    });
    expect(detail).not.toBeNull();
    expect(detail?.format).toBe('4P_HANCHAN');
    expect(detail?.ranking).toHaveLength(4);
    // たかし is the seeded 1st-place (points = 65); rank order ⇒ first row.
    expect(detail?.ranking[0]?.playerName).toBe('たかし');
    expect(detail?.ranking[0]?.totalPoints).toBeCloseTo(65, 5);
    expect(detail?.games).toHaveLength(1);
    expect(detail?.games[0]?.results).toHaveLength(4);
    // results are sorted by rank asc.
    expect(detail?.games[0]?.results.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('returns null for cross-owner matchId', async () => {
    await seedFor(owner);
    const store = getGroupServerStore();
    const match = [...store.matches.values()].find((m) => m.name === '第 1 節');
    if (!match) throw new Error('expected seeded match');

    const detail = await getMatchDetailHandler({
      ownerId: otherOwner,
      groupId: fridayGroupId(otherOwner),
      matchId: match.id,
    });
    expect(detail).toBeNull();
  });
});

describe('listMatchesHandler', () => {
  it('lists every Match in the scoped Group when no leagueId is supplied', async () => {
    await seedFor(owner);
    const list = await listMatchesHandler({ ownerId: owner, groupId: fridayGroupId(owner) });
    if (list === null) throw new Error('expected the seeded group to resolve');
    expect(list.groupId).toBe(fridayGroupId(owner));
    expect(list.matches.length).toBeGreaterThan(0);
    expect(list.scope.leagueId).toBeNull();
    expect(list.scope.leagueName).toBeNull();
  });

  it('returns null for a Group owned by a different Owner', async () => {
    await seedFor(otherOwner);
    const list = await listMatchesHandler({ ownerId: owner, groupId: fridayGroupId(otherOwner) });
    expect(list).toBeNull();
  });

  it('returns null for an unknown Group id', async () => {
    await seedFor(owner);
    const list = await listMatchesHandler({ ownerId: owner, groupId: 'no-such-group' });
    expect(list).toBeNull();
  });

  it('filters to a single League when leagueId is supplied', async () => {
    const seeded = await seedFor(owner);
    const target = seeded.leagues[0];
    if (!target) throw new Error('expected a seeded league');

    const list = await listMatchesHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      leagueId: target.id,
    });
    if (list === null) throw new Error('expected the seeded group to resolve');
    expect(list.scope.leagueId).toBe(target.id);
    expect(list.matches.every((m) => m.leagueId === target.id)).toBe(true);
  });

  it('silently drops a leagueId outside the scoped Group (falls back to the Group-wide list)', async () => {
    // Materialise the other owner first, so they have at least one League.
    const other = await seedFor(otherOwner);
    const foreign = other.leagues[0];
    if (!foreign) throw new Error('expected the other owner to have a league');

    const list = await listMatchesHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      leagueId: foreign.id,
    });
    if (list === null) throw new Error('expected the seeded group to resolve');
    expect(list.scope.leagueId).toBeNull();
  });

  it('surfaces the scoped Group s Leagues as leagueOptions for the in-page リーグセレクタ', async () => {
    const seeded = await seedFor(owner);
    const list = await listMatchesHandler({ ownerId: owner, groupId: fridayGroupId(owner) });
    if (list === null) throw new Error('expected the seeded group to resolve');

    // Every League in the scoped Group surfaces — including those without
    // matches yet. The create context already filters to this Group.
    expect(list.leagueOptions.map((o) => o.id).sort()).toEqual(
      seeded.leagues.map((l) => l.id).sort(),
    );
  });

  it('does not leak foreign Leagues into leagueOptions', async () => {
    await seedFor(owner);
    const otherSeed = await seedFor(otherOwner);
    const foreignIds = new Set(otherSeed.leagues.map((l) => l.id));

    const list = await listMatchesHandler({ ownerId: owner, groupId: fridayGroupId(owner) });
    if (list === null) throw new Error('expected the seeded group to resolve');
    expect(list.leagueOptions.every((o) => !foreignIds.has(o.id))).toBe(true);
  });
});

describe('submitGameHandler', () => {
  it('creates a new Game with GameResult rows and recomputes the Match ranking', async () => {
    await seedFor(owner);
    const store = getGroupServerStore();
    const match = [...store.matches.values()].find((m) => m.name === '第 1 節');
    if (!match) throw new Error('expected seeded match');

    const ruleset = store.rulesets.get(match.defaultRulesetId ?? '');
    if (!ruleset) throw new Error('expected default ruleset');

    const playerIds = [
      `dev-${owner}-friday-player-1`,
      `dev-${owner}-friday-player-2`,
      `dev-${owner}-friday-player-3`,
      `dev-${owner}-friday-player-4`,
    ];

    const { gameId } = await submitGameHandler({
      ownerId: owner,
      matchId: match.id,
      gameId: null,
      rulesetId: ruleset.id,
      playedAt: '2026-05-15T00:00:00.000Z',
      players: [
        { playerId: playerIds[0], rawScore: 50000, tobiRole: null },
        { playerId: playerIds[1], rawScore: 30000, tobiRole: null },
        { playerId: playerIds[2], rawScore: 15000, tobiRole: null },
        { playerId: playerIds[3], rawScore: 5000, tobiRole: null },
      ],
    });

    // The Game was persisted.
    expect(store.games.get(gameId)).toBeDefined();
    // GameResult rows were written.
    for (const pid of playerIds) {
      expect(store.gameResults.get(gameResultKey(gameId, pid))).toBeDefined();
    }

    // Ranking now reflects two games. たかし still leads since both his
    // raw scores were the highest.
    const detail = await getMatchDetailHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      matchId: match.id,
    });
    expect(detail?.games).toHaveLength(2);
    expect(detail?.ranking[0]?.playerName).toBe('たかし');
    expect(detail?.ranking[0]?.gameCount).toBe(2);
    expect(detail?.ranking[0]?.topCount).toBe(2);
  });

  it('rejects raw score sums that do not match startingScore × players', async () => {
    await seedFor(owner);
    const store = getGroupServerStore();
    const match = [...store.matches.values()].find((m) => m.name === '第 1 節');
    if (!match) throw new Error('expected seeded match');
    const ruleset = store.rulesets.get(match.defaultRulesetId ?? '');
    if (!ruleset) throw new Error('expected default ruleset');

    await expect(
      submitGameHandler({
        ownerId: owner,
        matchId: match.id,
        gameId: null,
        rulesetId: ruleset.id,
        playedAt: '2026-05-15T00:00:00.000Z',
        players: [
          { playerId: `dev-${owner}-friday-player-1`, rawScore: 50000, tobiRole: null },
          { playerId: `dev-${owner}-friday-player-2`, rawScore: 30000, tobiRole: null },
          { playerId: `dev-${owner}-friday-player-3`, rawScore: 15000, tobiRole: null },
          // Sum = 105000, but expected = 100000.
          { playerId: `dev-${owner}-friday-player-4`, rawScore: 10000, tobiRole: null },
        ],
      }),
    ).rejects.toThrow();
  });

  it('updates an existing Game (S12) and replaces its GameResult rows', async () => {
    await seedFor(owner);
    const store = getGroupServerStore();
    const match = [...store.matches.values()].find((m) => m.name === '第 1 節');
    if (!match) throw new Error('expected seeded match');
    const ruleset = store.rulesets.get(match.defaultRulesetId ?? '');
    if (!ruleset) throw new Error('expected default ruleset');

    const existingGame = [...store.games.values()].find((g) => g.matchId === match.id);
    if (!existingGame) throw new Error('expected seeded game');

    // Flip 1st and 2nd.
    await submitGameHandler({
      ownerId: owner,
      matchId: match.id,
      gameId: existingGame.id,
      rulesetId: ruleset.id,
      playedAt: existingGame.playedAt,
      players: [
        { playerId: `dev-${owner}-friday-player-2`, rawScore: 50000, tobiRole: null },
        { playerId: `dev-${owner}-friday-player-1`, rawScore: 30000, tobiRole: null },
        { playerId: `dev-${owner}-friday-player-3`, rawScore: 15000, tobiRole: null },
        { playerId: `dev-${owner}-friday-player-4`, rawScore: 5000, tobiRole: null },
      ],
    });

    const detail = await getMatchDetailHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      matchId: match.id,
    });
    expect(detail?.games).toHaveLength(1);
    const top = detail?.ranking[0];
    expect(top?.playerName).toBe('なお');
    expect(top?.topCount).toBe(1);
  });

  it('rejects cross-owner submissions', async () => {
    await seedFor(owner);
    const store = getGroupServerStore();
    const match = [...store.matches.values()].find((m) => m.name === '第 1 節');
    if (!match) throw new Error('expected seeded match');
    const ruleset = store.rulesets.get(match.defaultRulesetId ?? '');
    if (!ruleset) throw new Error('expected default ruleset');

    await expect(
      submitGameHandler({
        ownerId: otherOwner,
        matchId: match.id,
        gameId: null,
        rulesetId: ruleset.id,
        playedAt: '2026-05-15T00:00:00.000Z',
        players: [
          { playerId: `dev-${owner}-friday-player-1`, rawScore: 50000, tobiRole: null },
          { playerId: `dev-${owner}-friday-player-2`, rawScore: 30000, tobiRole: null },
          { playerId: `dev-${owner}-friday-player-3`, rawScore: 15000, tobiRole: null },
          { playerId: `dev-${owner}-friday-player-4`, rawScore: 5000, tobiRole: null },
        ],
      }),
    ).rejects.toThrow(/not owned/);
  });
});

describe('deleteGameHandler', () => {
  it('removes the Game and its GameResult rows, then ranking goes empty', async () => {
    await seedFor(owner);
    const store = getGroupServerStore();
    const match = [...store.matches.values()].find((m) => m.name === '第 1 節');
    if (!match) throw new Error('expected seeded match');
    const game = [...store.games.values()].find((g) => g.matchId === match.id);
    if (!game) throw new Error('expected seeded game');

    const before = await getMatchDetailHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      matchId: match.id,
    });
    expect(before?.ranking).toHaveLength(4);

    const { deleted } = await deleteGameHandler({ ownerId: owner, gameId: game.id });
    expect(deleted).toBe(true);

    const after = await getMatchDetailHandler({
      ownerId: owner,
      groupId: fridayGroupId(owner),
      matchId: match.id,
    });
    expect(after?.games).toHaveLength(0);
    expect(after?.ranking).toHaveLength(0);
  });

  it('rejects cross-owner deletes', async () => {
    await seedFor(owner);
    const store = getGroupServerStore();
    const game = [...store.games.values()][0];
    if (!game) throw new Error('expected seeded game');

    await expect(deleteGameHandler({ ownerId: otherOwner, gameId: game.id })).rejects.toThrow(
      /not owned/,
    );
  });
});
