/**
 * TanStack Start server functions for the S10 Match 作成 screen
 * (`04-screens.md` § S10, `03-user-flow.md` § F5, Issue #20).
 *
 * Shape & boundaries — mirrors `server/leagues.ts` (Issue #18):
 *
 *   - Handlers (`getMatchCreateContextHandler`, `createMatchHandler`) are
 *     exported separately from the `createServerFn` wrappers so unit tests
 *     can drive them without bundling the RPC compiler.
 *
 *   - The route layer is the only place that crosses the RPC boundary; the
 *     presentational {@link MatchCreateScreen} never imports this module.
 *
 *   - The handlers reuse the shared in-memory store
 *     (`getGroupServerStore`) so writes are visible across screens within a
 *     single dev session. When the D1 binding becomes reachable (#39) the
 *     `makeRepos` factory is the only place that needs to change.
 *
 * `sequenceNumber` allocation:
 *   The doc (`03-user-flow.md` § F5) says "League 配下の場合は
 *   `sequenceNumber` を自動採番". We compute it as
 *   `max(existing.sequenceNumber) + 1`, defaulting to `1` when the League
 *   has no Matches. The allocation runs both at *context* load time (so
 *   the screen can preview the value) and at *create* time (so a race
 *   between two tabs cannot wedge two Matches onto the same number — the
 *   create handler re-reads the latest max immediately before insert).
 *
 * Group ownership check:
 *   `createMatchHandler` cross-checks that the target Group / League belong
 *   to the caller. We never trust client-supplied ids — even though the UI
 *   only exposes Owner-scoped options, the server is still the security
 *   boundary.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  CreatedMatchSummary,
  MatchCreateContext,
  MatchCreateGroupOption,
  MatchCreateLeagueOption,
  MatchCreateRulesetOption,
} from '../components/matches';
import type { Database } from '../db/client';
import type { Match, NewMatch } from '../db/schema';
import {
  DrizzleGameRepository,
  DrizzleGroupRepository,
  DrizzleLeagueRepository,
  DrizzleMatchRepository,
  DrizzlePlayerRepository,
  DrizzleRulesetRepository,
} from '../repositories/drizzle';
import type {
  GroupRepository,
  LeagueRepository,
  MatchRepository,
  PlayerRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { MatchService } from '../services/match-service';
import { getRequestDb, requireOwnerId } from './context';
import { getGroupServerStore, seedDevDataIfEmpty } from './groups-store';
import {
  MemoryGameRepository,
  MemoryGroupRepository,
  MemoryLeagueRepository,
  MemoryMatchRepository,
  MemoryPlayerRepository,
  MemoryRulesetRepository,
} from './memory-repos';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------

interface ServerRepos {
  service: MatchService;
  groups: GroupRepository;
  leagues: LeagueRepository;
  matches: MatchRepository;
  rulesets: RulesetRepository;
  players: PlayerRepository;
}

const makeRepos = (db?: Database): ServerRepos => {
  const built = db
    ? {
        groups: new DrizzleGroupRepository(db),
        leagues: new DrizzleLeagueRepository(db),
        matches: new DrizzleMatchRepository(db),
        rulesets: new DrizzleRulesetRepository(db),
        players: new DrizzlePlayerRepository(db),
        games: new DrizzleGameRepository(db),
      }
    : (() => {
        const store = getGroupServerStore();
        return {
          groups: new MemoryGroupRepository(store),
          leagues: new MemoryLeagueRepository(store),
          matches: new MemoryMatchRepository(store),
          rulesets: new MemoryRulesetRepository(store),
          players: new MemoryPlayerRepository(store),
          games: new MemoryGameRepository(store),
        };
      })();
  return {
    service: new MatchService(built.matches, built.games),
    groups: built.groups,
    leagues: built.leagues,
    matches: built.matches,
    rulesets: built.rulesets,
    players: built.players,
  };
};

// ---------------------------------------------------------------------------
// Input validators
// ---------------------------------------------------------------------------
// `ownerId` is resolved server-side from the session, never accepted on the
// wire; the `*Input` handler types add it back via `WithOwner`.

const getContextInput = z.object({
  /**
   * Optional `?leagueId=` — when supplied the loader pins the screen to that
   * League. Validation only enforces the string shape; ownership / existence
   * are checked in the handler so a stale URL falls through to the
   * unbound-form variant rather than a hard 4xx.
   */
  leagueId: z.string().min(1).optional(),
  /**
   * Optional `?groupId=` — used when the caller arrived from a non-League
   * context (e.g. a Group home page) and wants the form pre-pinned to a
   * particular Group.
   */
  groupId: z.string().min(1).optional(),
});

const createMatchInput = z.object({
  groupId: z.string().min(1),
  /**
   * `null` = League 外 Match. The handler additionally rejects a non-null
   * `leagueId` whose Group does not match `groupId` (defensive cross-check).
   */
  leagueId: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(60),
  /** ISO `YYYY-MM-DD`. */
  heldAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  memo: z.string().trim().max(240).nullable(),
  defaultRulesetId: z.string().min(1).nullable(),
});

type WithOwner<T> = T & { ownerId: string };

export type GetMatchCreateContextInput = WithOwner<z.infer<typeof getContextInput>>;
export type CreateMatchInput = WithOwner<z.infer<typeof createMatchInput>>;

/**
 * Returns the next `sequenceNumber` for a League: `max(existing) + 1`, or `1`
 * when the League has no Matches. Takes a {@link MatchRepository} so it works
 * against either the in-memory store or D1. Exported for testing — production
 * callers go through {@link getMatchCreateContextHandler} or
 * {@link createMatchHandler}.
 */
export const computeNextSequenceNumber = async (
  matches: MatchRepository,
  leagueId: string,
): Promise<number> => {
  const existing = await matches.listByLeague(leagueId);
  let max = 0;
  for (const m of existing) {
    if (m.sequenceNumber !== null && m.sequenceNumber > max) {
      max = m.sequenceNumber;
    }
  }
  return max + 1;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Resolves the loader payload powering the S10 form. Returns the Groups /
 * Leagues / Rulesets the Owner may pick from, plus initial selections derived
 * from the `?leagueId=` / `?groupId=` query.
 *
 * Cross-Owner safety:
 *   - We always start from "Groups owned by the caller". Leagues / Rulesets
 *     surfaced are filtered to those Group ids. A `?leagueId=` pointing at a
 *     foreign League is silently dropped (the loader returns `initialLeagueId
 *     = null`) — the screen then renders the cross-Group form, which is the
 *     safer recovery.
 *
 *   - `?groupId=` is similarly dropped when foreign; we fall back to the
 *     Owner's first Group as the initial selection.
 */
export const getMatchCreateContextHandler = async (
  input: GetMatchCreateContextInput,
  db?: Database,
): Promise<MatchCreateContext> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);
  const repos = makeRepos(db);

  const ownedGroups = [...(await repos.groups.listByOwner(input.ownerId))].sort((a, b) =>
    a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0,
  );

  // Gather Leagues / Rulesets / Players per owned Group through the
  // repositories — works identically against the in-memory store and D1.
  const perGroup = await Promise.all(
    ownedGroups.map(async (group) => {
      const [groupLeagues, groupRulesets, groupPlayers] = await Promise.all([
        repos.leagues.listByGroup(group.id),
        repos.rulesets.listByGroup(group.id),
        repos.players.listByGroup(group.id),
      ]);
      return { group, groupLeagues, groupRulesets, groupPlayers };
    }),
  );

  const groups: ReadonlyArray<MatchCreateGroupOption> = ownedGroups.map((g) => ({
    id: g.id,
    name: g.name,
    defaultRulesetId: g.defaultRulesetId,
  }));

  // Leagues across every owned Group, tagged with `groupId` + `format` so the
  // screen can filter client-side and lock the format selector on League pick.
  const leagues: MatchCreateLeagueOption[] = [];
  for (const { groupLeagues } of perGroup) {
    for (const league of groupLeagues) {
      leagues.push({
        id: league.id,
        groupId: league.groupId,
        name: league.name,
        format: league.format,
        defaultRulesetId: league.defaultRulesetId,
      });
    }
  }

  // Rulesets across every owned Group.
  const rulesets: MatchCreateRulesetOption[] = [];
  for (const { group, groupRulesets } of perGroup) {
    for (const ruleset of groupRulesets) {
      rulesets.push({
        id: ruleset.id,
        groupId: ruleset.groupId,
        name: ruleset.name,
        startingScore: ruleset.startingScore,
        returnScore: ruleset.returnScore,
        umaPattern: ruleset.umaPattern,
        isGroupDefault: group.defaultRulesetId === ruleset.id,
      });
    }
  }

  // Active-Player counts per Group. We pre-aggregate here so the screen can
  // gate 3-player Match creation without a second round trip.
  const activePlayerCountByGroup: Record<string, number> = {};
  for (const { group, groupPlayers } of perGroup) {
    activePlayerCountByGroup[group.id] = groupPlayers.filter((p) => p.isActive).length;
  }

  // Resolve the initial Group / League. A foreign / stale `?leagueId=` is
  // dropped here so the screen renders the unbound form instead of erroring.
  let initialLeagueId: string | null = null;
  let initialGroupId: string | null = null;
  let initialSequenceNumber: number | null = null;

  const ownedGroupIds = new Set(ownedGroups.map((g) => g.id));

  if (input.leagueId !== undefined) {
    const candidate = leagues.find((l) => l.id === input.leagueId);
    if (candidate !== undefined) {
      initialLeagueId = candidate.id;
      initialGroupId = candidate.groupId;
      initialSequenceNumber = await computeNextSequenceNumber(repos.matches, candidate.id);
    }
  }

  if (initialGroupId === null) {
    if (input.groupId !== undefined && ownedGroupIds.has(input.groupId)) {
      initialGroupId = input.groupId;
    } else {
      initialGroupId = ownedGroups[0]?.id ?? null;
    }
  }

  return {
    groups,
    leagues,
    rulesets,
    activePlayerCountByGroup,
    initialLeagueId,
    initialGroupId,
    initialSequenceNumber,
  };
};

/**
 * Persists a new Match under a Group owned by the caller.
 *
 * Cross-checks performed before insert:
 *   1. Group exists and is owned by the caller.
 *   2. When `leagueId !== null`, the League exists *and* belongs to the
 *      same Group. The form locks the League selector to the route-locked
 *      League, but we re-check defensively.
 *   3. When `defaultRulesetId !== null`, the Ruleset belongs to the same
 *      Group.
 *
 * `sequenceNumber` is auto-allocated when a League is supplied. Reading the
 * max immediately before insert keeps two concurrent tabs from issuing the
 * same number — within the limits of an in-memory store; under D1 the same
 * read-then-insert pair will run inside a transaction (tracked with #39).
 */
export const createMatchHandler = async (
  input: CreateMatchInput,
  db?: Database,
): Promise<CreatedMatchSummary> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);
  const { groups, leagues, rulesets, matches, service } = makeRepos(db);

  const group = await groups.findById(input.groupId);
  if (!group || group.ownerId !== input.ownerId) {
    throw new Error('Group not found or not owned by caller.');
  }

  let leagueId: string | null = null;
  let sequenceNumber: number | null = null;
  if (input.leagueId !== null) {
    const league = await leagues.findById(input.leagueId);
    if (!league || league.groupId !== group.id) {
      throw new Error('League not found in the selected Group.');
    }
    leagueId = league.id;
    sequenceNumber = await computeNextSequenceNumber(matches, league.id);
  }

  if (input.defaultRulesetId !== null) {
    const ruleset = await rulesets.findById(input.defaultRulesetId);
    if (!ruleset || ruleset.groupId !== group.id) {
      throw new Error('Ruleset not found in the selected Group.');
    }
  }

  const newRow: NewMatch = {
    id: globalThis.crypto.randomUUID(),
    groupId: group.id,
    leagueId,
    name: input.name,
    sequenceNumber,
    heldAt: input.heldAt,
    memo: input.memo,
    defaultRulesetId: input.defaultRulesetId,
  };
  const created: Match = await service.create(newRow);

  return {
    id: created.id,
    groupId: created.groupId,
    leagueId: created.leagueId,
    name: created.name,
    sequenceNumber: created.sequenceNumber,
  };
};

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const getMatchCreateContextServerFn = createServerFn({ method: 'GET' })
  .inputValidator(getContextInput)
  .handler(async ({ data }) =>
    getMatchCreateContextHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const createMatchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createMatchInput)
  .handler(async ({ data }) =>
    createMatchHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );
