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
   * The Group the form is scoped to. Required since Issue #61: the create page
   * lives at `/groups/:groupId/matches/new`, so `groupId` always comes from the
   * URL path. A foreign / unknown id resolves to `null` (the route redirects to
   * `/groups`).
   */
  groupId: z.string().min(1),
  /**
   * Optional `?leagueId=` — when supplied the loader pins the screen to that
   * League. The handler verifies the League belongs to `groupId`; a stale /
   * foreign id falls through to the unbound (League 外) form rather than a hard
   * 4xx.
   */
  leagueId: z.string().min(1).optional(),
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
 * Resolves the loader payload powering the S10 form, scoped to the single
 * Group in the URL path (`/groups/:groupId/matches/new`, Issue #61). Returns
 * the Group's Leagues / Rulesets / active-Player count, plus the initial
 * selections derived from the `?leagueId=` query.
 *
 * Returns `null` when the Group does not exist or is owned by a different
 * Owner; the route surfaces that as a redirect to `/groups`. Ownership is the
 * server's responsibility — we never trust the path `groupId` on the wire.
 *
 * A `?leagueId=` pointing at a League outside this Group (foreign / stale) is
 * silently dropped (the loader returns `initialLeagueId = null`) — the form
 * then renders the League 外 variant, which is the safer recovery.
 */
export const getMatchCreateContextHandler = async (
  input: GetMatchCreateContextInput,
  db?: Database,
): Promise<MatchCreateContext | null> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);
  const repos = makeRepos(db);

  // Ownership guard: the Group must exist and belong to the caller.
  const group = await repos.groups.findById(input.groupId);
  if (group === null || group.ownerId !== input.ownerId) return null;

  const [groupLeagues, groupRulesets, groupPlayers] = await Promise.all([
    repos.leagues.listByGroup(group.id),
    repos.rulesets.listByGroup(group.id),
    repos.players.listByGroup(group.id),
  ]);

  // The Group selector collapses to the single scoped Group, so the form is
  // locked to the Group in the path.
  const groups: ReadonlyArray<MatchCreateGroupOption> = [
    { id: group.id, name: group.name, defaultRulesetId: group.defaultRulesetId },
  ];

  // Leagues in the scoped Group, tagged with `format` so the screen can lock
  // the format selector on League pick.
  const leagues: MatchCreateLeagueOption[] = groupLeagues.map((league) => ({
    id: league.id,
    groupId: league.groupId,
    name: league.name,
    format: league.format,
    defaultRulesetId: league.defaultRulesetId,
  }));

  // Rulesets in the scoped Group.
  const rulesets: MatchCreateRulesetOption[] = groupRulesets.map((ruleset) => ({
    id: ruleset.id,
    groupId: ruleset.groupId,
    name: ruleset.name,
    startingScore: ruleset.startingScore,
    returnScore: ruleset.returnScore,
    umaPattern: ruleset.umaPattern,
    isGroupDefault: group.defaultRulesetId === ruleset.id,
  }));

  // Active-Player count for the scoped Group, used to gate 3-player creation.
  const activePlayerCountByGroup: Record<string, number> = {
    [group.id]: groupPlayers.filter((p) => p.isActive).length,
  };

  // Resolve the initial League. A `?leagueId=` outside this Group is dropped
  // here so the screen renders the League 外 form instead of erroring.
  let initialLeagueId: string | null = null;
  let initialSequenceNumber: number | null = null;
  if (input.leagueId !== undefined) {
    const candidate = leagues.find((l) => l.id === input.leagueId);
    if (candidate !== undefined) {
      initialLeagueId = candidate.id;
      initialSequenceNumber = await computeNextSequenceNumber(repos.matches, candidate.id);
    }
  }

  return {
    groups,
    leagues,
    rulesets,
    activePlayerCountByGroup,
    initialLeagueId,
    initialGroupId: group.id,
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
