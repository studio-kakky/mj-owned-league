/**
 * Process-wide in-memory store backing the Owner-side server functions
 * (Issue #15 `/groups`, Issue #14 `/` dashboard, …).
 *
 * Why a module-level singleton:
 *   The server functions are stateless from the caller's perspective (each
 *   is its own RPC), but they need to share data across invocations within a
 *   single `vite dev` run — otherwise a "create then list" request pair
 *   would see different stores. Hanging the Maps off a `globalThis` key
 *   makes the singleton survive hot module replacement inside Vite's dev
 *   server, which is exactly the right scope for the "pretend D1 is wired"
 *   interim.
 *
 * Why this is acceptable interim behaviour:
 *   - Restarting the Node process clears the store. That matches the
 *     "no real database yet" reality of the current scaffolding.
 *   - The store is server-side: the client can only mutate it via the
 *     declared server functions. Replacing this module with a Drizzle-backed
 *     repository (when the D1 binding becomes reachable from server
 *     functions, tracked separately as #39) is a one-file change in the
 *     consuming server modules — no contract change.
 *
 * Seed data:
 *   `seedDevDataIfEmpty` runs once on first access per ownerId. It mirrors
 *   the dev-only fixtures that previously lived on the client
 *   (`/_owner/groups.tsx`) so manual QA can still walk through the create /
 *   edit / delete (with and without history) flows. Seeding is keyed on
 *   `ownerId` so two simultaneous dev sessions logged in as different
 *   owners don't pollute each other's view.
 *
 *   For S3 the seed additionally materialises a couple of Players, an
 *   active League with a Match, plus one PENDING invitation so the
 *   dashboard cards / summaries are non-empty at first paint.
 */

import type {
  Game,
  GameResult,
  Group,
  Invitation,
  League,
  Match,
  NewGame,
  NewGameResult,
  NewGroup,
  NewInvitation,
  NewLeague,
  NewMatch,
  NewPlayer,
  NewRuleset,
  Player,
  Ruleset,
} from '../db/schema';
import {
  DEFAULT_RULESET_NAME,
  DEFAULT_RULESET_RETURN_SCORE,
  DEFAULT_RULESET_STARTING_SCORE,
  DEFAULT_RULESET_UMA_PATTERN,
} from '../services/group-service';

/**
 * Shape of each per-entity insert input the repositories accept. Exposed so
 * server modules can avoid re-declaring `NewGroup` etc. for their repository
 * implementations.
 */
export interface InMemoryStoreShape {
  groups: NewGroup;
  rulesets: NewRuleset;
  games: NewGame;
  players: NewPlayer;
  leagues: NewLeague;
  matches: NewMatch;
  invitations: NewInvitation;
  gameResults: NewGameResult;
}

export interface GroupServerStore {
  groups: Map<string, Group>;
  rulesets: Map<string, Ruleset>;
  games: Map<string, Game>;
  players: Map<string, Player>;
  leagues: Map<string, League>;
  matches: Map<string, Match>;
  invitations: Map<string, Invitation>;
  /**
   * Per-game per-player outcome rows. Keyed by `${gameId}::${playerId}` so a
   * Game's full result can be re-read by walking the map. The Drizzle schema
   * keys these on `(gameId, playerId)` composite PK — we hash that into a
   * string here to keep the Map interface uniform with the other entities.
   */
  gameResults: Map<string, GameResult>;
  /**
   * Set of owner ids that have already had their dev seed materialised. Kept
   * as a `Set` so the seed runs at most once per owner even across many
   * `listGroups` calls.
   */
  seededOwnerIds: Set<string>;
}

// `globalThis` keyed singleton — survives Vite HMR (which discards module
// instances) for the same reason `next/cache`'s globalThis trick works.
const GLOBAL_KEY = Symbol.for('janroku.groups.server-store');

interface GlobalWithStore {
  [GLOBAL_KEY]?: GroupServerStore;
}

const createEmptyStore = (): GroupServerStore => {
  return {
    groups: new Map(),
    rulesets: new Map(),
    games: new Map(),
    players: new Map(),
    leagues: new Map(),
    matches: new Map(),
    invitations: new Map(),
    gameResults: new Map(),
    seededOwnerIds: new Set(),
  };
};

/**
 * Composite key helper for `gameResults`. Exported so server modules use a
 * single canonical form when reading / writing this map.
 */
export const gameResultKey = (gameId: string, playerId: string): string => {
  return `${gameId}::${playerId}`;
};

export const getGroupServerStore = (): GroupServerStore => {
  const g = globalThis as unknown as GlobalWithStore;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createEmptyStore();
  }
  return g[GLOBAL_KEY];
};

/**
 * Test-only escape hatch — resets the singleton so tests can run in
 * isolation. Production code never imports this.
 */
export const resetGroupServerStoreForTests = (): void => {
  const g = globalThis as unknown as GlobalWithStore;
  g[GLOBAL_KEY] = createEmptyStore();
};

/**
 * Materialises the dev seed for `ownerId` if we haven't already. The seed
 * intentionally creates one Group with history (so the delete-confirm
 * modal's "履歴があるため削除できません" branch is reachable during manual
 * QA) and one fresh Group.
 *
 * Called from the loader so it runs on the first list request and never
 * again. The early-return on `seededOwnerIds.has(ownerId)` makes this safe
 * to call from every `listGroups` invocation.
 */
export const seedDevDataIfEmpty = (ownerId: string): void => {
  const store = getGroupServerStore();
  if (store.seededOwnerIds.has(ownerId)) return;
  store.seededOwnerIds.add(ownerId);

  // Only seed the demo Groups when this owner has nothing yet. If the dev
  // restarted the Node process but still has data (impossible today; future-
  // proofing for when this swaps to D1), we don't double-seed.
  const owned = [...store.groups.values()].filter((g) => g.ownerId === ownerId);
  if (owned.length > 0) return;

  const now = new Date().toISOString();

  // Group with history: "金曜定例会" + one persisted Game so hasHistory = true.
  const g1Id = `dev-${ownerId}-friday`;
  const r1Id = `dev-${ownerId}-friday-default-ruleset`;
  store.groups.set(g1Id, {
    id: g1Id,
    ownerId,
    name: '金曜定例会',
    defaultRulesetId: r1Id,
    createdAt: now,
  });
  store.rulesets.set(r1Id, {
    id: r1Id,
    groupId: g1Id,
    name: DEFAULT_RULESET_NAME,
    startingScore: DEFAULT_RULESET_STARTING_SCORE,
    returnScore: DEFAULT_RULESET_RETURN_SCORE,
    umaPattern: DEFAULT_RULESET_UMA_PATTERN,
    tobiEnabled: false,
    tobiPoint: null,
  });
  const gameId = `dev-${ownerId}-friday-game-1`;
  store.games.set(gameId, {
    id: gameId,
    groupId: g1Id,
    matchId: null,
    leagueId: null,
    format: '4P_HANCHAN',
    rulesetId: r1Id,
    playedAt: '2026-05-08T00:00:00.000Z',
    createdAt: now,
  });

  // Empty Group: "会社の同期会" — deletable.
  const g2Id = `dev-${ownerId}-company`;
  const r2Id = `dev-${ownerId}-company-default-ruleset`;
  store.groups.set(g2Id, {
    id: g2Id,
    ownerId,
    name: '会社の同期会',
    defaultRulesetId: r2Id,
    createdAt: now,
  });
  store.rulesets.set(r2Id, {
    id: r2Id,
    groupId: g2Id,
    name: DEFAULT_RULESET_NAME,
    startingScore: DEFAULT_RULESET_STARTING_SCORE,
    returnScore: DEFAULT_RULESET_RETURN_SCORE,
    umaPattern: DEFAULT_RULESET_UMA_PATTERN,
    tobiEnabled: false,
    tobiPoint: null,
  });

  // ---------------------------------------------------------------------
  // S3 (Issue #14) dashboard fixtures — Players, an active League, the
  // Match that holds the seeded Game above, and one PENDING invitation.
  //
  // The "active" concept is not modelled in the schema (`League` has no
  // `endedAt` column). The S3 server function treats *every* League whose
  // Group is owned by the caller as "active" for MVP; this seed therefore
  // only needs one League to make the active-league card render.
  // ---------------------------------------------------------------------

  const fridayPlayerNames = ['たかし', 'なお', 'ゆうき', 'みき'];
  for (const [index, name] of fridayPlayerNames.entries()) {
    const playerId = `dev-${ownerId}-friday-player-${index + 1}`;
    store.players.set(playerId, {
      id: playerId,
      groupId: g1Id,
      name,
      isActive: true,
      createdAt: now,
    });
  }

  const leagueId = `dev-${ownerId}-friday-league-spring`;
  store.leagues.set(leagueId, {
    id: leagueId,
    groupId: g1Id,
    name: '2026 春シーズン',
    format: '4P_HANCHAN',
    defaultRulesetId: r1Id,
    publicSlug: `dev-spring-${ownerId.slice(0, 6)}`,
    createdAt: now,
  });

  const matchId = `dev-${ownerId}-friday-match-1`;
  store.matches.set(matchId, {
    id: matchId,
    groupId: g1Id,
    leagueId,
    name: '第 1 節',
    sequenceNumber: 1,
    heldAt: '2026-05-08',
    memo: null,
    defaultRulesetId: r1Id,
    createdAt: now,
  });

  // Back-fill the seeded Game so it points at the new Match / League; that
  // way the dashboard's "recent games" feed has a row that is also wired up
  // to a Match / League (= active).
  const seededGame = store.games.get(gameId);
  if (seededGame) {
    store.games.set(gameId, {
      ...seededGame,
      matchId,
      leagueId,
    });
  }

  // Seed GameResult rows so the S7 ranking / S9 順位表 has populated data on
  // first paint. Four players, raw scores sum to 100000 (= startingScore ×
  // players), with explicit ranks; we hand-compute points here using the
  // UMA_10_30 + oka math so the seed survives any future calculator drift —
  // tests still pin the calculator independently.
  //
  // たかし 45000 → 1st
  // なお    32000 → 2nd
  // ゆうき 18000 → 3rd
  // みき     5000 → 4th
  // points (UMA_10_30, oka 20 = (30000-25000)*4 /1000):
  //   1st: (45000-30000)/1000 + 30 + 20 = 15 + 30 + 20 = 65
  //   2nd: (32000-30000)/1000 + 10      =  2 + 10      = 12
  //   3rd: (18000-30000)/1000 - 10      = -12 - 10     = -22
  //   4th: ( 5000-30000)/1000 - 30      = -25 - 30     = -55
  const seedGameResults: ReadonlyArray<{
    playerSuffix: number;
    raw: number;
    rank: number;
    pts: number;
  }> = [
    { playerSuffix: 1, raw: 45000, rank: 1, pts: 65 },
    { playerSuffix: 2, raw: 32000, rank: 2, pts: 12 },
    { playerSuffix: 3, raw: 18000, rank: 3, pts: -22 },
    { playerSuffix: 4, raw: 5000, rank: 4, pts: -55 },
  ];
  for (const r of seedGameResults) {
    const playerId = `dev-${ownerId}-friday-player-${r.playerSuffix}`;
    store.gameResults.set(gameResultKey(gameId, playerId), {
      gameId,
      playerId,
      rawScore: r.raw,
      points: r.pts,
      rank: r.rank,
      tobiRole: null,
    });
  }

  const invitationId = `dev-${ownerId}-invitation-1`;
  store.invitations.set(invitationId, {
    id: invitationId,
    issuedByOwnerId: ownerId,
    memo: '次回参加候補',
    token: `dev-token-${ownerId.slice(0, 8)}-1`,
    status: 'PENDING',
    expiresAt: '2099-01-01T00:00:00.000Z',
    consumedByUserId: null,
    consumedAt: null,
    revokedAt: null,
    createdAt: now,
  });
};
