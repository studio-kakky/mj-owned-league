/**
 * Tests for the S3 dashboard server-function handler (Issue #14).
 *
 * Like the `/groups` server tests, we exercise the handler directly rather
 * than the `createServerFn` wrapper. Each test resets the module-level store
 * via `resetGroupServerStoreForTests` so seed materialisation and per-test
 * mutations don't leak.
 *
 * The dashboard's "active match" predicate depends on wall-clock time. We
 * pass an explicit `now` into the handler in every test that cares so the
 * outcome is deterministic.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_RECENT_LIMIT } from '../../../src/components/dashboard';
import { dashboardHandler } from '../../../src/server/dashboard';
import { createGroupHandler, listGroupsHandler } from '../../../src/server/groups';
import {
  getGroupServerStore,
  resetGroupServerStoreForTests,
} from '../../../src/server/groups-store';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

// The dev seed sets the seeded Game's `playedAt` to 2026-05-08, so any
// "now" we pin should be after that to be meaningful.
const fixedNow = new Date('2026-05-15T00:00:00.000Z');

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('dashboardHandler — seeded state', () => {
  it('returns the two seeded groups for the owner', async () => {
    const result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });

    const names = result.groups.map((g) => g.name).sort();
    expect(names).toEqual(['会社の同期会', '金曜定例会']);
  });

  it('projects the seeded league as active with a matching last-played date', async () => {
    const result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });

    expect(result.activeLeagues).toHaveLength(1);
    const league = result.activeLeagues[0];
    expect(league?.name).toBe('2026 春シーズン');
    expect(league?.groupName).toBe('金曜定例会');
    expect(league?.matchCount).toBe(1);
    expect(league?.gameCount).toBe(1);
    expect(league?.lastPlayedAt).toBe('2026-05-08T00:00:00.000Z');
  });

  it('projects the seeded match as active', async () => {
    const result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });

    expect(result.activeMatches).toHaveLength(1);
    const match = result.activeMatches[0];
    expect(match?.name).toBe('第 1 節');
    expect(match?.leagueName).toBe('2026 春シーズン');
    expect(match?.gameCount).toBe(1);
  });

  it('includes the seeded game in the recent-games feed', async () => {
    const result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });

    expect(result.recentGames).toHaveLength(1);
    const game = result.recentGames[0];
    expect(game?.matchName).toBe('第 1 節');
    expect(game?.leagueName).toBe('2026 春シーズン');
    expect(game?.groupName).toBe('金曜定例会');
  });

  it('counts the one seeded PENDING invitation', async () => {
    const result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    expect(result.pendingInvitationCount).toBe(1);
  });
});

describe('dashboardHandler — owner isolation', () => {
  it('does not return another owner’s groups', async () => {
    await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    const other = await dashboardHandler({ ownerId: otherOwner }, { now: () => fixedNow });

    // Both owners see their own seed but never the other's rows.
    const otherIds = other.groups.map((g) => g.id);
    expect(otherIds.every((id) => id.startsWith(`dev-${otherOwner}-`))).toBe(true);
    expect(otherIds.some((id) => id.startsWith(`dev-${owner}-`))).toBe(false);
  });

  it('does not count another owner’s invitations', async () => {
    // Seed both owners.
    await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    await dashboardHandler({ ownerId: otherOwner }, { now: () => fixedNow });

    const result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    // Still just the one PENDING invitation owned by `owner`.
    expect(result.pendingInvitationCount).toBe(1);
  });
});

describe('dashboardHandler — empty state for a fresh group', () => {
  it('returns an empty recent-games feed for a brand-new Group with no games', async () => {
    resetGroupServerStoreForTests();

    // Brand-new owner with one fresh Group, no games / leagues / matches.
    const fresh = 'owner-fresh';
    await createGroupHandler({ ownerId: fresh, name: 'はじめてのグループ' });
    // `createGroupHandler` does not seed dev fixtures (it goes through the
    // service directly), but `dashboardHandler` will — that adds a couple of
    // groups, games, etc. To exercise the empty-state we strip the store
    // back down to just the fresh group + its ruleset and re-run.
    const store = getGroupServerStore();
    for (const [id, g] of store.groups) {
      if (g.ownerId !== fresh) store.groups.delete(id);
    }
    for (const [id, r] of store.rulesets) {
      if (!store.groups.has(r.groupId)) store.rulesets.delete(id);
    }
    store.games.clear();
    store.leagues.clear();
    store.matches.clear();
    store.invitations.clear();
    store.players.clear();
    // Mark the seed as already-applied for the fresh owner so the next
    // `dashboardHandler` does not re-materialise it.
    store.seededOwnerIds.add(fresh);

    const result = await dashboardHandler({ ownerId: fresh }, { now: () => fixedNow });

    expect(result.groups).toHaveLength(1);
    expect(result.activeLeagues).toEqual([]);
    expect(result.activeMatches).toEqual([]);
    expect(result.recentGames).toEqual([]);
    expect(result.pendingInvitationCount).toBe(0);
  });
});

describe('dashboardHandler — sorting + trimming', () => {
  it(`trims recent games to ${DASHBOARD_RECENT_LIMIT} rows in playedAt-desc order`, async () => {
    // Materialise seed first.
    await listGroupsHandler({ ownerId: owner });
    const store = getGroupServerStore();
    // Find the seeded "金曜定例会" group to reuse its ruleset.
    const group = [...store.groups.values()].find(
      (g) => g.ownerId === owner && g.name === '金曜定例会',
    );
    expect(group).toBeDefined();
    const rulesetId = group?.defaultRulesetId ?? '';

    // Inject 7 extra games with monotonically increasing playedAt. Together
    // with the 1 seeded game we have 8 total → handler should return 5.
    for (let i = 0; i < 7; i++) {
      const id = `extra-game-${i}`;
      store.games.set(id, {
        id,
        groupId: group?.id ?? '',
        matchId: null,
        leagueId: null,
        format: '4P_HANCHAN',
        rulesetId,
        playedAt: `2026-06-0${i + 1}T00:00:00.000Z`,
        createdAt: '2026-06-01T00:00:00.000Z',
      });
    }

    const result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    expect(result.recentGames).toHaveLength(DASHBOARD_RECENT_LIMIT);

    // Descending by playedAt.
    for (let i = 0; i < result.recentGames.length - 1; i++) {
      const current = result.recentGames[i];
      const next = result.recentGames[i + 1];
      expect(current && next && current.playedAt >= next.playedAt).toBe(true);
    }
  });
});

describe('dashboardHandler — invitation status filtering', () => {
  it('does not count CONSUMED or REVOKED invitations', async () => {
    await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    const store = getGroupServerStore();

    // Mutate the seeded invitation through several end-states and confirm
    // each is excluded.
    const seeded = [...store.invitations.values()].find((i) => i.issuedByOwnerId === owner);
    expect(seeded).toBeDefined();
    if (!seeded) return;

    store.invitations.set(seeded.id, { ...seeded, status: 'CONSUMED' });
    let result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    expect(result.pendingInvitationCount).toBe(0);

    store.invitations.set(seeded.id, { ...seeded, status: 'REVOKED' });
    result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    expect(result.pendingInvitationCount).toBe(0);

    // Expired PENDING also drops out.
    store.invitations.set(seeded.id, {
      ...seeded,
      status: 'PENDING',
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    result = await dashboardHandler({ ownerId: owner }, { now: () => fixedNow });
    expect(result.pendingInvitationCount).toBe(0);
  });
});
