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

const makeStubLeague = (slug: string) => {
  return {
    id: 'stub',
    groupId: 'g',
    name: 'stub',
    format: '4P_HANCHAN' as const,
    defaultRulesetId: null,
    publicSlug: slug,
    createdAt: new Date().toISOString(),
  };
};

/**
 * The dev-seed "金曜定例会" Group id for an Owner — the Group the seeded
 * "2026 春シーズン" League lives under. `listLeaguesHandler` now requires a
 * `groupId` (it comes from the URL path), so the tests anchor on this
 * deterministic id rather than enumerating Groups. See
 * `groups-store.ts#seedDevDataIfEmpty` (`g1Id = dev-${ownerId}-friday`).
 */
const seedGroupId = (ownerId: string): string => `dev-${ownerId}-friday`;

describe('listLeaguesHandler', () => {
  it('materialises the dev seed and returns the seeded League for the scoped Group', async () => {
    const data = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (data === null) throw new Error('expected the seeded group to resolve');
    expect(data.leagues).toHaveLength(1);
    const [first] = data.leagues;
    if (!first) throw new Error('expected one league in the seed');
    expect(first.name).toBe('2026 春シーズン');
    expect(first.matchCount).toBe(1);
    expect(first.gameCount).toBe(1);
    expect(first.publicSlug).toBe(`dev-spring-${owner.slice(0, 6)}`);
  });

  it('returns null for a Group owned by a different Owner', async () => {
    // Seed both owners, then ask as `owner` for `otherOwner`'s group.
    await listLeaguesHandler({ ownerId: otherOwner, groupId: seedGroupId(otherOwner) });
    const data = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(otherOwner) });
    expect(data).toBeNull();
  });

  it('returns null for an unknown Group id', async () => {
    const data = await listLeaguesHandler({ ownerId: owner, groupId: 'no-such-group' });
    expect(data).toBeNull();
  });

  it('returns the single scoped Group and its Ruleset options for the create modal', async () => {
    const data = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (data === null) throw new Error('expected the seeded group to resolve');
    // The dropdown is locked to the Group in the path: exactly one option.
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.id).toBe(seedGroupId(owner));
    expect(data.rulesets.length).toBeGreaterThan(0);
    // Every ruleset belongs to the scoped Group.
    expect(data.rulesets.every((r) => r.groupId === seedGroupId(owner))).toBe(true);
  });
});

describe('getLeagueDetailHandler', () => {
  it('returns null for a non-existent League', async () => {
    const detail = await getLeagueDetailHandler({
      ownerId: owner,
      groupId: seedGroupId(owner),
      leagueId: 'no-such-id',
    });
    expect(detail).toBeNull();
  });

  it('returns null when the League belongs to a different Owner', async () => {
    const list = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (list === null) throw new Error('expected the seeded group to resolve');
    const target = list.leagues[0];
    if (!target) throw new Error('expected a seeded league');
    const detail = await getLeagueDetailHandler({
      ownerId: otherOwner,
      groupId: seedGroupId(owner),
      leagueId: target.id,
    });
    expect(detail).toBeNull();
  });

  it('returns null when the League does not belong to the groupId in the path', async () => {
    const list = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (list === null) throw new Error('expected the seeded group to resolve');
    const target = list.leagues[0];
    if (!target) throw new Error('expected a seeded league');
    // The League is real and owned, but the path points at the *other* seeded
    // Group ("会社サークル", dev-${owner}-company) — must resolve to null.
    const detail = await getLeagueDetailHandler({
      ownerId: owner,
      groupId: `dev-${owner}-company`,
      leagueId: target.id,
    });
    expect(detail).toBeNull();
  });

  it('surfaces the seeded League with its Match and most-recent Game', async () => {
    const list = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (list === null) throw new Error('expected the seeded group to resolve');
    const target = list.leagues[0];
    if (!target) throw new Error('expected a seeded league');
    const detail = await getLeagueDetailHandler({
      ownerId: owner,
      groupId: seedGroupId(owner),
      leagueId: target.id,
    });
    expect(detail).not.toBeNull();
    expect(detail?.name).toBe('2026 春シーズン');
    expect(detail?.matches).toHaveLength(1);
    expect(detail?.recentGames).toHaveLength(1);
    // Issue #19 wired GameResult-backed ranking into the projection. The
    // seeded Game has four results (たかし / なお / ゆうき / みき) so the
    // ranking surfaces all four players, top-of-list at たかし.
    expect(detail?.ranking).toHaveLength(4);
    expect(detail?.ranking?.[0]?.playerName).toBe('たかし');
    expect(detail?.ranking?.[0]?.topCount).toBe(1);
    expect(detail?.publicSlug).toBeDefined();
  });
});

describe('createLeagueHandler', () => {
  it('creates a new League under a Group owned by the caller and assigns a publicSlug', async () => {
    // Materialise the seed so the Owner has at least one Group to anchor on.
    const seeded = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (seeded === null) throw new Error('expected the seeded group to resolve');
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
    const after = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (after === null) throw new Error('expected the seeded group to resolve');
    expect(after.leagues.map((l) => l.name)).toContain('2026 秋シーズン');
  });

  it('rejects creation when the Group belongs to a different Owner', async () => {
    // Seed the OTHER owner's groups, then try to create as `owner` against
    // one of those Group ids.
    const other = await listLeaguesHandler({
      ownerId: otherOwner,
      groupId: seedGroupId(otherOwner),
    });
    if (other === null) throw new Error('expected the other owner group to resolve');
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
    const seeded = await listLeaguesHandler({ ownerId: owner, groupId: seedGroupId(owner) });
    if (seeded === null) throw new Error('expected the seeded group to resolve');
    const ownGroup = seeded.groups[0];
    if (!ownGroup) throw new Error('expected a seeded group');

    // Pull a Ruleset from the Owner's *other* seeded Group ("会社サークル").
    // The list handler is now Group-scoped, so we query that Group explicitly
    // to obtain a Ruleset that does not belong to `ownGroup`.
    const otherGroup = await listLeaguesHandler({
      ownerId: owner,
      groupId: `dev-${owner}-company`,
    });
    if (otherGroup === null) throw new Error('expected the company group to resolve');
    const foreignRuleset = otherGroup.rulesets.find((r) => r.groupId !== ownGroup.id);
    if (!foreignRuleset) throw new Error('expected a foreign ruleset in the other group');

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
  const makeRepo = (taken: ReadonlySet<string>): LeagueRepository => {
    return {
      findById: async () => null,
      findByPublicSlug: async (slug: string) => (taken.has(slug) ? makeStubLeague(slug) : null),
      listByGroup: async () => [],
      create: async () => makeStubLeague('unused'),
      update: async () => null,
      delete: async () => false,
    };
  };

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
