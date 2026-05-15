/**
 * Tests for the `/leagues` server-function handlers (Issue #18).
 *
 * Same shape as the existing `tests/unit/server/groups.test.ts` and
 * `tests/unit/server/settings.test.ts` — we exercise the *handlers*
 * (`listLeaguesHandler` etc.) directly rather than the `createServerFn`
 * wrappers, which need the TanStack Start compiler to be meaningfully
 * invokable. The handlers carry the actual logic: ownership filtering,
 * `publicSlug` generation, Group cross-check on create.
 *
 * `resetGroupServerStoreForTests` runs in `beforeEach` so the dev seed and
 * any created Leagues from the previous test do not leak.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { LeagueRepository } from '../../../src/repositories/interfaces';
import { resetGroupServerStoreForTests } from '../../../src/server/groups-store';
import {
  createLeagueHandler,
  generatePublicSlug,
  getLeagueDetailHandler,
  listLeaguesHandler,
} from '../../../src/server/leagues';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

beforeEach(() => {
  resetGroupServerStoreForTests();
});

describe('listLeaguesHandler', () => {
  it('materialises the dev seed on first call and returns the seeded League with the Group label', async () => {
    const data = await listLeaguesHandler({ ownerId: owner });
    expect(data.leagues).toHaveLength(1);
    const [first] = data.leagues;
    if (!first) throw new Error('expected one league in the seed');
    expect(first.name).toBe('2026 春シーズン');
    expect(first.groupName).toBe('金曜定例会');
    expect(first.matchCount).toBe(1);
    expect(first.gameCount).toBe(1);
    expect(first.publicSlug).toBe(`dev-spring-${owner.slice(0, 6)}`);
  });

  it('isolates Leagues across Owners', async () => {
    await listLeaguesHandler({ ownerId: owner });
    const other = await listLeaguesHandler({ ownerId: otherOwner });
    // The other owner sees its own seed, not the first owner's League.
    expect(other.leagues.every((l) => l.id.startsWith(`dev-${otherOwner}-`))).toBe(true);
  });

  it('returns the Owner-scoped Group and Ruleset option lists for the create modal', async () => {
    const data = await listLeaguesHandler({ ownerId: owner });
    expect(data.groups.length).toBeGreaterThan(0);
    expect(data.groups.every((g) => g.name.length > 0)).toBe(true);
    expect(data.rulesets.length).toBeGreaterThan(0);
    // Every ruleset is tagged with one of the Owner's Groups.
    const ownedGroupIds = new Set(data.groups.map((g) => g.id));
    expect(data.rulesets.every((r) => ownedGroupIds.has(r.groupId))).toBe(true);
  });
});

describe('getLeagueDetailHandler', () => {
  it('returns null for a non-existent League', async () => {
    const detail = await getLeagueDetailHandler({ ownerId: owner, leagueId: 'no-such-id' });
    expect(detail).toBeNull();
  });

  it('returns null when the League belongs to a different Owner', async () => {
    const { leagues } = await listLeaguesHandler({ ownerId: owner });
    const target = leagues[0];
    if (!target) throw new Error('expected a seeded league');
    const detail = await getLeagueDetailHandler({
      ownerId: otherOwner,
      leagueId: target.id,
    });
    expect(detail).toBeNull();
  });

  it('surfaces the seeded League with its Match and most-recent Game', async () => {
    const { leagues } = await listLeaguesHandler({ ownerId: owner });
    const target = leagues[0];
    if (!target) throw new Error('expected a seeded league');
    const detail = await getLeagueDetailHandler({ ownerId: owner, leagueId: target.id });
    expect(detail).not.toBeNull();
    expect(detail?.name).toBe('2026 春シーズン');
    expect(detail?.matches).toHaveLength(1);
    expect(detail?.recentGames).toHaveLength(1);
    expect(detail?.ranking).toEqual([]); // GameResult is not modelled yet.
    expect(detail?.publicSlug).toBeDefined();
  });
});

describe('createLeagueHandler', () => {
  it('creates a new League under a Group owned by the caller and assigns a publicSlug', async () => {
    // Materialise the seed so the Owner has at least one Group to anchor on.
    const seeded = await listLeaguesHandler({ ownerId: owner });
    const targetGroup = seeded.groups[0];
    if (!targetGroup) throw new Error('expected a seeded group');

    const created = await createLeagueHandler({
      ownerId: owner,
      groupId: targetGroup.id,
      name: '2026 秋シーズン',
      format: '4P_HANCHAN',
      defaultRulesetId: null,
    });

    expect(created.name).toBe('2026 秋シーズン');
    expect(created.format).toBe('4P_HANCHAN');
    expect(created.groupId).toBe(targetGroup.id);
    expect(created.publicSlug.length).toBeGreaterThan(0);
    // The slug should be distinct from the seeded League's slug.
    const seededSlug = seeded.leagues[0]?.publicSlug ?? '';
    expect(created.publicSlug).not.toBe(seededSlug);

    // The list reflects the new League.
    const after = await listLeaguesHandler({ ownerId: owner });
    expect(after.leagues.map((l) => l.name)).toContain('2026 秋シーズン');
  });

  it('rejects creation when the Group belongs to a different Owner', async () => {
    // Seed the OTHER owner's groups, then try to create as `owner` against
    // one of those Group ids.
    const other = await listLeaguesHandler({ ownerId: otherOwner });
    const foreign = other.groups[0];
    if (!foreign) throw new Error('expected the other owner to have a group');

    await expect(
      createLeagueHandler({
        ownerId: owner,
        groupId: foreign.id,
        name: 'should fail',
        format: '4P_HANCHAN',
        defaultRulesetId: null,
      }),
    ).rejects.toThrow(/not owned/);
  });

  it('rejects an explicit defaultRulesetId that belongs to a different Group', async () => {
    const seeded = await listLeaguesHandler({ ownerId: owner });
    const ownGroup = seeded.groups[0];
    if (!ownGroup) throw new Error('expected a seeded group');

    // Find any Ruleset NOT belonging to the chosen group. The dev seed has
    // exactly one ruleset per group, so any ruleset whose groupId !== ownGroup.id
    // works.
    const foreignRuleset = seeded.rulesets.find((r) => r.groupId !== ownGroup.id);
    if (!foreignRuleset) throw new Error('expected a foreign ruleset in the seed');

    await expect(
      createLeagueHandler({
        ownerId: owner,
        groupId: ownGroup.id,
        name: 'wrong-ruleset',
        format: '4P_HANCHAN',
        defaultRulesetId: foreignRuleset.id,
      }),
    ).rejects.toThrow(/Ruleset/);
  });
});

describe('generatePublicSlug', () => {
  // Minimal fake LeagueRepository: only `findByPublicSlug` is exercised. We
  // declare it as a `Pick<...>` so the type system covers the surface we
  // touch without forcing us to stub a dozen methods we never call.
  function makeRepo(taken: ReadonlySet<string>): LeagueRepository {
    return {
      findById: async () => null,
      findByPublicSlug: async (slug: string) => (taken.has(slug) ? makeStubLeague(slug) : null),
      listByGroup: async () => [],
      create: async () => makeStubLeague('unused'),
      update: async () => null,
      delete: async () => false,
    };
  }

  it('returns the first slug when it is unused', async () => {
    const repo = makeRepo(new Set());
    const slug = await generatePublicSlug(repo, () => 'fixed-slug');
    expect(slug).toBe('fixed-slug');
  });

  it('retries until it finds an unused slug', async () => {
    const repo = makeRepo(new Set(['taken-a', 'taken-b']));
    const queue = ['taken-a', 'taken-b', 'fresh'];
    const slug = await generatePublicSlug(repo, () => queue.shift() ?? 'fresh');
    expect(slug).toBe('fresh');
  });

  it('throws when every retry collides', async () => {
    const repo = makeRepo(new Set(['always-taken']));
    await expect(generatePublicSlug(repo, () => 'always-taken')).rejects.toThrow(
      /Failed to generate/,
    );
  });
});

function makeStubLeague(slug: string) {
  return {
    id: 'stub',
    groupId: 'g',
    name: 'stub',
    format: '4P_HANCHAN' as const,
    defaultRulesetId: null,
    publicSlug: slug,
    createdAt: new Date().toISOString(),
  };
}
