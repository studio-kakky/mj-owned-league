/**
 * Tests for the S6 Group 詳細 (ホーム) server-function handler (Issue #16).
 *
 * Like the other server tests we exercise the handler directly rather than
 * the `createServerFn` wrapper, and we reset the module-level store via
 * `resetGroupServerStoreForTests` so seed materialisation and per-test
 * mutations don't leak across tests.
 *
 * The dev seed (`seedDevDataIfEmpty`) ships:
 *   - Group `dev-${ownerId}-friday` ("金曜定例会") with 4 active players,
 *     1 League ("2026 春シーズン"), 1 Match ("第 1 節"), 1 Game, 4
 *     GameResult rows.
 *   - Group `dev-${ownerId}-company` ("会社の同期会") — empty.
 *
 * That gives us a realistic populated path and a realistic empty path in
 * the same test file without manually wiring fixtures.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { groupHomeHandler } from '../../../src/server/group-home';
import { resetGroupServerStoreForTests } from '../../../src/server/groups-store';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('groupHomeHandler — populated seed', () => {
  const groupId = `dev-${owner}-friday`;

  it('returns the populated Group with name, createdAt, and player count', async () => {
    const result = await groupHomeHandler({ ownerId: owner, groupId });
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.id).toBe(groupId);
    expect(result.name).toBe('金曜定例会');
    expect(result.activePlayerCount).toBe(4);
    expect(result.totalGameCount).toBe(1);
    expect(result.lastPlayedAt).toBe('2026-05-08T00:00:00.000Z');
  });

  it('projects the seeded League with match / game counts', async () => {
    const result = await groupHomeHandler({ ownerId: owner, groupId });
    expect(result?.leagues).toHaveLength(1);
    const league = result?.leagues[0];
    expect(league?.name).toBe('2026 春シーズン');
    expect(league?.matchCount).toBe(1);
    expect(league?.gameCount).toBe(1);
    expect(league?.lastPlayedAt).toBe('2026-05-08T00:00:00.000Z');
  });

  it('projects the seeded Match with sequence and game count', async () => {
    const result = await groupHomeHandler({ ownerId: owner, groupId });
    expect(result?.matches).toHaveLength(1);
    const match = result?.matches[0];
    expect(match?.name).toBe('第 1 節');
    expect(match?.sequenceNumber).toBe(1);
    expect(match?.leagueName).toBe('2026 春シーズン');
    expect(match?.gameCount).toBe(1);
  });

  it('aggregates the seeded GameResult rows into the Group ranking (Issue #10)', async () => {
    const result = await groupHomeHandler({ ownerId: owner, groupId });
    // Four players, one Game's worth of GameResult rows seeded.
    expect(result?.ranking).toHaveLength(4);
    // Sorted by totalPoints desc — たかし scored 65 (1st place), みき scored -55 (last).
    const names = result?.ranking.map((r) => r.playerName);
    expect(names).toEqual(['たかし', 'なお', 'ゆうき', 'みき']);
    // Seeded GameResults carry the values the scoring pipeline produced; the
    // ranking simply sums them. We assert the headline value for たかし stays
    // intact through the projection.
    const top = result?.ranking[0];
    expect(top?.totalPoints).toBe(65);
    expect(top?.gameCount).toBe(1);
    expect(top?.topCount).toBe(1);
    expect(top?.averagePoints).toBe(65);
  });

  it('includes the seeded Game in the recent-games feed with Match / League names', async () => {
    const result = await groupHomeHandler({ ownerId: owner, groupId });
    expect(result?.recentGames).toHaveLength(1);
    const game = result?.recentGames[0];
    expect(game?.matchName).toBe('第 1 節');
    expect(game?.leagueName).toBe('2026 春シーズン');
    expect(game?.playedAt).toBe('2026-05-08T00:00:00.000Z');
  });
});

describe('groupHomeHandler — empty seed', () => {
  const groupId = `dev-${owner}-company`;

  it('returns the empty Group with zeroed metrics', async () => {
    const result = await groupHomeHandler({ ownerId: owner, groupId });
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.name).toBe('会社の同期会');
    expect(result.activePlayerCount).toBe(0);
    expect(result.totalGameCount).toBe(0);
    expect(result.lastPlayedAt).toBeNull();
    expect(result.leagues).toHaveLength(0);
    expect(result.matches).toHaveLength(0);
    expect(result.ranking).toHaveLength(0);
    expect(result.recentGames).toHaveLength(0);
  });
});

describe('groupHomeHandler — owner isolation', () => {
  it('returns null when the Group does not exist', async () => {
    const result = await groupHomeHandler({ ownerId: owner, groupId: 'no-such-group' });
    expect(result).toBeNull();
  });

  it('returns null when the Group exists but is owned by a different Owner', async () => {
    // Seed both owners so their groups exist side by side.
    await groupHomeHandler({ ownerId: owner, groupId: `dev-${owner}-friday` });
    await groupHomeHandler({ ownerId: otherOwner, groupId: `dev-${otherOwner}-friday` });
    // Now ask for `owner`'s group from `otherOwner`'s session.
    const result = await groupHomeHandler({
      ownerId: otherOwner,
      groupId: `dev-${owner}-friday`,
    });
    expect(result).toBeNull();
  });
});
