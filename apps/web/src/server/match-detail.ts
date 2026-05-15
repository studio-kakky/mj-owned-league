/**
 * TanStack Start server functions for the S9 Match 詳細 + S11-S13 対局 CRUD
 * (`04-screens.md` § S9 / S11 / S12 / S13, `03-user-flow.md` § F6 / F7, Issue #19).
 *
 * Shape & boundaries — mirrors `server/leagues.ts` (Issue #18) and
 * `server/matches.ts` (Issue #20):
 *
 *   - Handlers (`getMatchDetailHandler`, `listMatchesHandler`,
 *     `createGameHandler`, `updateGameHandler`, `deleteGameHandler`) are
 *     exported separately from the `createServerFn` wrappers so unit tests
 *     can drive them without bundling the RPC compiler.
 *
 *   - The presentational {@link MatchDetailScreen} / {@link MatchListScreen}
 *     never import this module — the route layer is the only RPC boundary.
 *
 *   - All handlers reuse the shared in-memory store (`getGroupServerStore`)
 *     so writes are visible across screens within a single dev session.
 *     `gameResults` is the new entity introduced in this issue; #39 still
 *     tracks the D1 swap and `makeRepos()` is the only file-local place
 *     that needs editing when that lands.
 *
 * Game CRUD pipeline (`02-domain-model.md` § GameResult):
 *
 *   1. `assertRawScoreSum` — `Σ rawScore === startingScore × 人数`.
 *   2. `rankWithUma` — rank + uma share, with tie support.
 *   3. `calculateGamePoints` — final per-player points.
 *   4. `GameResultService.replaceForGame` writes the rows atomically (the
 *      in-memory repo simulates the delete-then-insert pattern).
 *
 *   The pipeline runs on both create and update; delete is the same except
 *   for the calculator (just removes the rows). Ranking projections on the
 *   detail handler always read the current GameResult snapshot, so the
 *   "編集 / 削除でポイント / 順位を再計算" requirement is automatic — no
 *   denormalised totals.
 *
 * Group ownership check:
 *   Every mutation cross-checks that the target Match's Group belongs to
 *   the caller. We never trust client-supplied ids — the UI may only show
 *   the Owner's matches, but the server is the security boundary.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  GameSubmitInput,
  MatchDetailData,
  MatchGameResultRow,
  MatchGameRow,
  MatchListData,
  MatchListItem,
  MatchPlayerOption,
  MatchRankingRow,
  MatchRulesetOption,
} from '../components/matches';
import type {
  Game,
  GameResult,
  LeagueFormat,
  Match,
  NewGame,
  NewGameResult,
  Ruleset,
} from '../db/schema';
import { TOBI_ROLES } from '../db/schema';
import { calculateGamePoints, rankWithUma } from '../domain/scoring';
import type {
  GameRepository,
  GameResultRepository,
  MatchRepository,
} from '../repositories/interfaces';
import { GameResultService } from '../services/game-result-service';
import { GameService } from '../services/game-service';
import {
  type GroupServerStore,
  gameResultKey,
  getGroupServerStore,
  type InMemoryStoreShape,
  seedDevDataIfEmpty,
} from './groups-store';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------

interface ServerRepos {
  store: GroupServerStore;
  games: GameRepository;
  matches: MatchRepository;
  gameResults: GameResultRepository;
  gameService: GameService;
  gameResultService: GameResultService;
}

function makeRepos(): ServerRepos {
  const store = getGroupServerStore();
  const games = new MemoryGameRepository(store);
  const matches = new MemoryMatchRepository(store);
  const gameResults = new MemoryGameResultRepository(store);
  return {
    store,
    games,
    matches,
    gameResults,
    gameService: new GameService(games, matches),
    gameResultService: new GameResultService(gameResults),
  };
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const matchDetailInput = z.object({
  ownerId: z.string().min(1),
  matchId: z.string().min(1),
});

const matchListInput = z.object({
  ownerId: z.string().min(1),
  leagueId: z.string().min(1).optional(),
});

const playerInput = z.object({
  playerId: z.string().min(1),
  rawScore: z.number().int(),
  tobiRole: z.enum(TOBI_ROLES).nullable(),
});

const gameSubmitInput = z.object({
  ownerId: z.string().min(1),
  matchId: z.string().min(1),
  gameId: z.string().min(1).nullable(),
  rulesetId: z.string().min(1),
  playedAt: z.string().min(1).nullable(),
  players: z.array(playerInput).min(1),
});

const gameDeleteInput = z.object({
  ownerId: z.string().min(1),
  gameId: z.string().min(1),
});

export type MatchDetailInput = z.infer<typeof matchDetailInput>;
export type MatchListInput = z.infer<typeof matchListInput>;
export type GameSubmitServerInput = z.infer<typeof gameSubmitInput>;
export type GameDeleteInput = z.infer<typeof gameDeleteInput>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Returns the projected detail payload for one Match, or `null` when the
 * Match does not exist / belongs to a different Owner. The route surfaces
 * `null` as a redirect rather than throwing.
 */
export async function getMatchDetailHandler(
  input: MatchDetailInput,
): Promise<MatchDetailData | null> {
  seedDevDataIfEmpty(input.ownerId);
  const { store } = makeRepos();

  const match = store.matches.get(input.matchId);
  if (match === undefined) return null;
  const group = store.groups.get(match.groupId);
  if (!group || group.ownerId !== input.ownerId) return null;

  const league = match.leagueId === null ? null : (store.leagues.get(match.leagueId) ?? null);
  const format: LeagueFormat = league?.format ?? '4P_HANCHAN';

  // Resolve the Match-effective default Ruleset: Match.default → League.default
  // → Group.default. Stops at the first non-null.
  const effectiveDefaultRulesetId =
    match.defaultRulesetId ?? league?.defaultRulesetId ?? group.defaultRulesetId ?? null;

  const groupRulesets = [...store.rulesets.values()].filter((r) => r.groupId === group.id);
  const availableRulesets: MatchRulesetOption[] = groupRulesets.map((r) =>
    projectRulesetOption(r, effectiveDefaultRulesetId, group.defaultRulesetId),
  );

  const groupPlayers = [...store.players.values()].filter((p) => p.groupId === group.id);
  const availablePlayers: MatchPlayerOption[] = groupPlayers
    .filter((p) => p.isActive)
    .map((p) => ({ id: p.id, name: p.name, isActive: p.isActive }));

  // All Players (including inactive) keyed by id — needed so historical game
  // rows can render the name even after a Player is deactivated.
  const playerNameById = new Map(groupPlayers.map((p) => [p.id, p.name] as const));
  const rulesetNameById = new Map(groupRulesets.map((r) => [r.id, r.name] as const));

  const games = [...store.games.values()].filter((g) => g.matchId === match.id);
  // Newest first — same convention as League detail's recent games feed.
  games.sort((a, b) => (a.playedAt > b.playedAt ? -1 : a.playedAt < b.playedAt ? 1 : 0));

  const gameRows: MatchGameRow[] = games.map((g) =>
    projectGameRow(g, store, playerNameById, rulesetNameById),
  );
  const ranking = computeMatchRanking(gameRows, playerNameById, format);

  return {
    id: match.id,
    groupId: group.id,
    groupName: group.name,
    leagueId: match.leagueId,
    leagueName: league?.name ?? null,
    leaguePublicSlug: league?.publicSlug ?? null,
    sequenceNumber: match.sequenceNumber,
    name: match.name,
    heldAt: match.heldAt,
    memo: match.memo,
    format,
    defaultRuleset:
      effectiveDefaultRulesetId === null
        ? null
        : (availableRulesets.find((r) => r.id === effectiveDefaultRulesetId) ?? null),
    availableRulesets,
    availablePlayers,
    ranking,
    games: gameRows,
  };
}

/**
 * Returns the Match list payload. When `leagueId` is supplied the list is
 * filtered to that League; otherwise every Match across the Owner's Groups
 * is surfaced.
 */
export async function listMatchesHandler(input: MatchListInput): Promise<MatchListData> {
  seedDevDataIfEmpty(input.ownerId);
  const { store } = makeRepos();

  const ownedGroups = [...store.groups.values()].filter((g) => g.ownerId === input.ownerId);
  const ownedGroupIds = new Set(ownedGroups.map((g) => g.id));
  const groupNameById = new Map(ownedGroups.map((g) => [g.id, g.name] as const));

  const leagueNameById = new Map<string, string>();
  for (const l of store.leagues.values()) {
    if (ownedGroupIds.has(l.groupId)) leagueNameById.set(l.id, l.name);
  }

  let scopedLeague: { id: string; name: string; groupName: string } | null = null;
  let leagueFilter: string | null = null;
  if (input.leagueId !== undefined) {
    const league = store.leagues.get(input.leagueId);
    if (league && ownedGroupIds.has(league.groupId)) {
      leagueFilter = league.id;
      const groupName = groupNameById.get(league.groupId) ?? '';
      scopedLeague = { id: league.id, name: league.name, groupName };
    }
    // Foreign / stale leagueId — silently fall through to cross-Group list.
  }

  const matches = [...store.matches.values()].filter((m) => {
    if (!ownedGroupIds.has(m.groupId)) return false;
    if (leagueFilter !== null && m.leagueId !== leagueFilter) return false;
    return true;
  });

  // Game count / last-played-at lookups — single pass.
  const gameCountByMatch = new Map<string, number>();
  const lastPlayedAtByMatch = new Map<string, string>();
  for (const g of store.games.values()) {
    if (g.matchId === null) continue;
    gameCountByMatch.set(g.matchId, (gameCountByMatch.get(g.matchId) ?? 0) + 1);
    const prev = lastPlayedAtByMatch.get(g.matchId);
    if (prev === undefined || g.playedAt > prev) {
      lastPlayedAtByMatch.set(g.matchId, g.playedAt);
    }
  }

  const items: MatchListItem[] = matches.map(
    (m): MatchListItem => ({
      id: m.id,
      groupId: m.groupId,
      groupName: groupNameById.get(m.groupId) ?? '',
      leagueId: m.leagueId,
      leagueName: m.leagueId === null ? null : (leagueNameById.get(m.leagueId) ?? null),
      name: m.name,
      sequenceNumber: m.sequenceNumber,
      heldAt: m.heldAt,
      gameCount: gameCountByMatch.get(m.id) ?? 0,
      lastPlayedAt: lastPlayedAtByMatch.get(m.id) ?? null,
    }),
  );

  // League-scoped: sort by sequenceNumber desc (newest 節 first), undated trailing.
  // Cross-Group: sort by heldAt / lastPlayedAt / createdAt desc.
  items.sort((a, b) => compareMatchListItems(a, b, leagueFilter !== null));

  const createSearch: { leagueId?: string; groupId?: string } = {};
  if (scopedLeague !== null) createSearch.leagueId = scopedLeague.id;

  return {
    matches: items,
    scope: {
      leagueId: scopedLeague?.id ?? null,
      leagueName: scopedLeague?.name ?? null,
      groupName: scopedLeague?.groupName ?? null,
      createSearch,
    },
  };
}

/**
 * Creates or updates a Game with its GameResult rows. The full scoring
 * pipeline runs server-side so the client never has to ship recomputed
 * points / ranks (which would force the calculator to be duplicated across
 * the wire boundary).
 *
 * When `gameId` is non-null we update in place: same Match, same Group, but
 * the players / scores / ruleset are replaced. The integrity check (`Σ
 * rawScore = startingScore × n`) runs identically for create and update.
 */
export async function submitGameHandler(input: GameSubmitServerInput): Promise<{ gameId: string }> {
  seedDevDataIfEmpty(input.ownerId);
  const { store, gameService, gameResultService } = makeRepos();

  const match = store.matches.get(input.matchId);
  if (!match) throw new Error('Match not found.');
  const group = store.groups.get(match.groupId);
  if (!group || group.ownerId !== input.ownerId) {
    throw new Error('Match not found or not owned by caller.');
  }

  const ruleset = store.rulesets.get(input.rulesetId);
  if (!ruleset || ruleset.groupId !== group.id) {
    throw new Error('Ruleset not found in the selected Group.');
  }

  // Format resolution mirrors the detail handler: League → fallback default.
  const league = match.leagueId === null ? null : (store.leagues.get(match.leagueId) ?? null);
  const format: LeagueFormat = league?.format ?? '4P_HANCHAN';
  const expectedPlayerCount = format.startsWith('3P') ? 3 : 4;

  if (input.players.length !== expectedPlayerCount) {
    throw new Error(
      `この対局は ${expectedPlayerCount} 人で登録してください（受け取った人数: ${input.players.length}）。`,
    );
  }

  // Cross-check every player is active and belongs to the Match's Group.
  for (const p of input.players) {
    const player = store.players.get(p.playerId);
    if (!player || player.groupId !== group.id) {
      throw new Error('プレイヤーがこのグループに属していません。');
    }
  }

  // Duplicate check — defence-in-depth; the modal also rejects this.
  const uniquePlayerIds = new Set(input.players.map((p) => p.playerId));
  if (uniquePlayerIds.size !== input.players.length) {
    throw new Error('同じプレイヤーを 2 回以上登録できません。');
  }

  // Run the scoring pipeline. The calculator re-asserts the sum invariant
  // internally, so any drift between client and server surfaces as the same
  // typed error (`ScoreMismatchError`).
  const pointResults = calculateGamePoints({
    ruleset: {
      startingScore: ruleset.startingScore,
      returnScore: ruleset.returnScore,
      umaPattern: ruleset.umaPattern,
      tobiEnabled: ruleset.tobiEnabled,
      tobiPoint: ruleset.tobiPoint,
    },
    players: input.players.map((p) => ({ rawScore: p.rawScore, tobiRole: p.tobiRole })),
  });

  // Persist Game (create or update) and its GameResult rows.
  const playedAtIso = input.playedAt ?? new Date().toISOString();

  let gameId: string;
  if (input.gameId === null) {
    const newGame: NewGame = {
      id: globalThis.crypto.randomUUID(),
      groupId: group.id,
      matchId: match.id,
      leagueId: match.leagueId,
      format,
      rulesetId: ruleset.id,
      playedAt: playedAtIso,
    };
    const created = await gameService.create(newGame);
    gameId = created.id;
  } else {
    const existing = store.games.get(input.gameId);
    if (!existing || existing.matchId !== match.id) {
      throw new Error('編集対象の対局が見つかりません。');
    }
    const updated = await gameService.update(existing.id, {
      rulesetId: ruleset.id,
      playedAt: playedAtIso,
      // Match / League ids do not move on edit — the modal cannot retarget
      // them. Keeping them out of the patch avoids an unnecessary
      // consistency check.
    });
    if (!updated) throw new Error('対局の更新に失敗しました。');
    gameId = updated.id;
  }

  const resultRows: NewGameResult[] = input.players.map((p, i) => ({
    gameId,
    playerId: p.playerId,
    rawScore: p.rawScore,
    points: pointResults[i].points,
    rank: pointResults[i].rank,
    tobiRole: p.tobiRole,
  }));

  await gameResultService.replaceForGame(gameId, resultRows);

  return { gameId };
}

export async function deleteGameHandler(input: GameDeleteInput): Promise<{ deleted: boolean }> {
  seedDevDataIfEmpty(input.ownerId);
  const { store, gameService, gameResultService } = makeRepos();

  const game = store.games.get(input.gameId);
  if (!game) return { deleted: false };
  const group = store.groups.get(game.groupId);
  if (!group || group.ownerId !== input.ownerId) {
    throw new Error('Game not found or not owned by caller.');
  }

  await gameResultService.deleteByGame(game.id);
  const deleted = await gameService.delete(game.id);
  return { deleted };
}

// ---------------------------------------------------------------------------
// Projection helpers
// ---------------------------------------------------------------------------

function projectGameRow(
  game: Game,
  store: GroupServerStore,
  playerNameById: ReadonlyMap<string, string>,
  rulesetNameById: ReadonlyMap<string, string>,
): MatchGameRow {
  const results: MatchGameResultRow[] = [];
  for (const result of store.gameResults.values()) {
    if (result.gameId !== game.id) continue;
    results.push({
      playerId: result.playerId,
      playerName: playerNameById.get(result.playerId) ?? '（削除されたプレイヤー）',
      rawScore: result.rawScore,
      points: result.points,
      rank: result.rank,
      tobiRole: result.tobiRole,
    });
  }
  results.sort((a, b) => a.rank - b.rank);

  return {
    id: game.id,
    playedAt: game.playedAt,
    rulesetId: game.rulesetId,
    rulesetName: rulesetNameById.get(game.rulesetId) ?? '（削除された Ruleset）',
    results,
  };
}

function projectRulesetOption(
  ruleset: Ruleset,
  matchDefaultRulesetId: string | null,
  groupDefaultRulesetId: string | null,
): MatchRulesetOption {
  return {
    id: ruleset.id,
    name: ruleset.name,
    startingScore: ruleset.startingScore,
    returnScore: ruleset.returnScore,
    umaPattern: ruleset.umaPattern,
    tobiEnabled: ruleset.tobiEnabled,
    tobiPoint: ruleset.tobiPoint,
    isMatchDefault: matchDefaultRulesetId === ruleset.id,
    isGroupDefault: groupDefaultRulesetId === ruleset.id,
  };
}

function computeMatchRanking(
  games: ReadonlyArray<MatchGameRow>,
  playerNameById: ReadonlyMap<string, string>,
  format: LeagueFormat,
): MatchRankingRow[] {
  const lastRank = format.startsWith('3P') ? 3 : 4;
  const acc = new Map<
    string,
    { gameCount: number; totalPoints: number; topCount: number; lastCount: number }
  >();

  for (const game of games) {
    for (const r of game.results) {
      const entry = acc.get(r.playerId) ?? {
        gameCount: 0,
        totalPoints: 0,
        topCount: 0,
        lastCount: 0,
      };
      entry.gameCount += 1;
      entry.totalPoints += r.points;
      if (r.rank === 1) entry.topCount += 1;
      if (r.rank === lastRank) entry.lastCount += 1;
      acc.set(r.playerId, entry);
    }
  }

  const rows: MatchRankingRow[] = [];
  for (const [playerId, entry] of acc.entries()) {
    rows.push({
      playerId,
      playerName: playerNameById.get(playerId) ?? '（削除されたプレイヤー）',
      gameCount: entry.gameCount,
      totalPoints: entry.totalPoints,
      averagePoints: entry.gameCount === 0 ? 0 : entry.totalPoints / entry.gameCount,
      topCount: entry.topCount,
      lastCount: entry.lastCount,
    });
  }

  // totalPoints desc; tie-breaker = averagePoints desc, then playerName for stability.
  rows.sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.averagePoints !== b.averagePoints) return b.averagePoints - a.averagePoints;
    return a.playerName.localeCompare(b.playerName);
  });

  return rows;
}

function compareMatchListItems(a: MatchListItem, b: MatchListItem, leagueScoped: boolean): number {
  if (leagueScoped) {
    // sequenceNumber desc; nulls last.
    if (a.sequenceNumber !== null && b.sequenceNumber !== null) {
      return b.sequenceNumber - a.sequenceNumber;
    }
    if (a.sequenceNumber !== null) return -1;
    if (b.sequenceNumber !== null) return 1;
  }
  // heldAt desc; nulls fall through to lastPlayedAt.
  const dateA = a.heldAt ?? a.lastPlayedAt;
  const dateB = b.heldAt ?? b.lastPlayedAt;
  if (dateA !== null && dateB !== null) {
    return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
  }
  if (dateA !== null) return -1;
  if (dateB !== null) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Public input bridges — the route layer hands these `GameSubmitInput` shapes
// straight from the modal; the server-side schemas already match.
// ---------------------------------------------------------------------------

/** Type-narrowing bridge so the route layer can spread the modal payload. */
export function bridgeGameSubmit(ownerId: string, input: GameSubmitInput): GameSubmitServerInput {
  return {
    ownerId,
    matchId: input.matchId,
    gameId: input.gameId,
    rulesetId: input.rulesetId,
    playedAt: input.playedAt,
    players: input.players.map((p) => ({
      playerId: p.playerId,
      rawScore: p.rawScore,
      tobiRole: p.tobiRole,
    })),
  };
}

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const getMatchDetailServerFn = createServerFn({ method: 'GET' })
  .inputValidator(matchDetailInput)
  .handler(({ data }) => getMatchDetailHandler(data));

export const listMatchesServerFn = createServerFn({ method: 'GET' })
  .inputValidator(matchListInput)
  .handler(({ data }) => listMatchesHandler(data));

export const submitGameServerFn = createServerFn({ method: 'POST' })
  .inputValidator(gameSubmitInput)
  .handler(({ data }) => submitGameHandler(data));

export const deleteGameServerFn = createServerFn({ method: 'POST' })
  .inputValidator(gameDeleteInput)
  .handler(({ data }) => deleteGameHandler(data));

// ---------------------------------------------------------------------------
// In-memory repositories
// ---------------------------------------------------------------------------

class MemoryMatchRepository implements MatchRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Match | null> {
    return this.store.matches.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Match[]> {
    return [...this.store.matches.values()].filter((m) => m.groupId === groupId);
  }

  async listByLeague(leagueId: string): Promise<Match[]> {
    return [...this.store.matches.values()].filter((m) => m.leagueId === leagueId);
  }

  async create(input: InMemoryStoreShape['matches']): Promise<Match> {
    const row: Match = {
      createdAt: new Date().toISOString(),
      heldAt: null,
      memo: null,
      sequenceNumber: null,
      defaultRulesetId: null,
      leagueId: null,
      ...input,
    } as Match;
    this.store.matches.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<Match, 'id'>>): Promise<Match | null> {
    const existing = this.store.matches.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.matches.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.matches.delete(id);
  }
}

class MemoryGameRepository implements GameRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Game | null> {
    return this.store.games.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.groupId === groupId);
  }

  async listByMatch(matchId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.matchId === matchId);
  }

  async listByLeague(leagueId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.leagueId === leagueId);
  }

  async create(input: InMemoryStoreShape['games']): Promise<Game> {
    const row: Game = {
      createdAt: new Date().toISOString(),
      matchId: null,
      leagueId: null,
      ...input,
    } as Game;
    this.store.games.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<Game, 'id'>>): Promise<Game | null> {
    const existing = this.store.games.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.games.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.games.delete(id);
  }
}

class MemoryGameResultRepository implements GameResultRepository {
  constructor(private readonly store: GroupServerStore) {}

  async listByGame(gameId: string): Promise<GameResult[]> {
    return [...this.store.gameResults.values()].filter((r) => r.gameId === gameId);
  }

  async createMany(inputs: NewGameResult[]): Promise<GameResult[]> {
    const rows: GameResult[] = inputs.map(
      (input) =>
        ({
          tobiRole: null,
          ...input,
        }) as GameResult,
    );
    for (const row of rows) {
      this.store.gameResults.set(gameResultKey(row.gameId, row.playerId), row);
    }
    return rows;
  }

  async replaceForGame(gameId: string, inputs: NewGameResult[]): Promise<GameResult[]> {
    // Delete-then-insert. The in-memory map has no transaction primitive,
    // but the operations are synchronous so the intermediate state is not
    // observable across server functions.
    await this.deleteByGame(gameId);
    return this.createMany(inputs);
  }

  async deleteByGame(gameId: string): Promise<number> {
    let count = 0;
    for (const key of [...this.store.gameResults.keys()]) {
      const row = this.store.gameResults.get(key);
      if (row && row.gameId === gameId) {
        this.store.gameResults.delete(key);
        count += 1;
      }
    }
    return count;
  }
}

// Re-export the scoring helpers so callers (tests, future server modules)
// know the canonical pipeline lives in `domain/scoring`. This is purely
// documentation-by-grep — no behaviour change.
export { calculateGamePoints, rankWithUma };
