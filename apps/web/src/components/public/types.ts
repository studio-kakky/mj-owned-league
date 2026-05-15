/**
 * Types used by the P1-P4 public viewer screens (`04-screens.md` § P1 / P2 /
 * P3 / P4, `03-user-flow.md` § F8, Issue #23).
 *
 * Boundary rule mirrors the Owner-side screens
 * (`components/leagues/types.ts`, `components/matches/detail-types.ts`):
 * schema rows carry persistence concerns the viewer never needs, so the
 * server projects narrower display shapes. Viewer screens never import
 * Drizzle.
 *
 * Why a dedicated set of types rather than re-using the Owner ones:
 *   - The public surface deliberately omits edit affordances, IDs that
 *     would let a viewer enumerate sibling resources, and any field that
 *     could leak Group / Owner identity beyond what the slug already
 *     reveals.
 *   - Public ranking carries richer per-player aggregates (1 位率 / 平均
 *     着順 / ラス回数) per Issue #23. The Owner-side `LeagueRankingRow`
 *     stays minimal because the Owner already sees the full Match detail.
 *   - Splitting the types means the Owner surface can evolve (e.g. expose
 *     an Owner-only field) without forcing a viewer-side migration.
 *
 * `02-domain-model.md` § Match has no `publicSlug` column today; the only
 * canonical public URL for a Match is `/l/:publicSlug/matches/:sequenceNumber`
 * (composed in the Owner-side `MatchDetailScreen`). P3 `/m/:publicSlug`
 * therefore renders an "URL が無効" empty state for every input in MVP — the
 * route exists so the URL namespace from `04-screens.md` is reserved, but
 * adding a real Match-level slug is a separate Issue.
 */

import type { LeagueFormat, TobiRole, UmaPattern } from '../../db/schema';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * Ruleset summary surfaced verbatim on the public page header. Mirrors the
 * Owner-side `LeagueRulesetOption` but drops the `isGroupDefault` / `isMatchDefault`
 * flags — they expose Owner-internal state a viewer should not see.
 */
export interface PublicRulesetSummary {
  name: string;
  startingScore: number;
  returnScore: number;
  umaPattern: UmaPattern;
  /**
   * `null` when 飛び賞 is disabled. The viewer reads this as "飛び賞なし".
   */
  tobiPoint: number | null;
}

// ---------------------------------------------------------------------------
// P1 — League 公開ページ
// ---------------------------------------------------------------------------

/**
 * Top-level P1 payload (`/l/:publicSlug`).
 *
 * The shape mirrors `LeagueDetailData` but trims to the public-safe subset:
 *   - No `groupId` / `id` — viewers navigate by slug, not internal id.
 *   - `ranking` is the richer {@link PublicLeagueRankingRow} so § P4 can
 *     deep-link straight into the per-player view.
 *   - `matches` carries `sequenceNumber` (required for the `/l/$slug/matches/$seq`
 *     route) and `gameCount`; the `id` is preserved for keying only.
 *   - `recentGames` is dropped in favour of per-match drill-down — the
 *     viewer goes to P2 for game-level detail.
 */
export interface PublicLeagueData {
  /** Opaque slug; included so the screen can build per-Match URLs locally. */
  publicSlug: string;
  name: string;
  format: LeagueFormat;
  groupName: string;
  defaultRuleset: PublicRulesetSummary | null;
  ranking: ReadonlyArray<PublicLeagueRankingRow>;
  matches: ReadonlyArray<PublicLeagueMatchRow>;
}

export interface PublicLeagueMatchRow {
  /** Stable key for React; not part of any URL the viewer sees. */
  id: string;
  name: string;
  /**
   * Required for the per-Match public URL (`/l/:slug/matches/:sequenceNumber`).
   * For MVP every League-bound Match has one; standalone Matches do not, but
   * those never appear in P1.
   */
  sequenceNumber: number;
  heldAt: string | null;
  gameCount: number;
}

/**
 * Per-player aggregate row on the P1 順位表 — the richer projection called out
 * in Issue #23 (対局数 / 平均ポイント / 1 位率 / 平均着順 / ラス回数). The
 * row also carries `playerId` so the table can deep-link to P4.
 */
export interface PublicLeagueRankingRow {
  playerId: string;
  playerName: string;
  gameCount: number;
  totalPoints: number;
  averagePoints: number;
  /** Count of `rank === 1` finishes. */
  topCount: number;
  /** Count of `rank === N` finishes (N = 3 for 3P formats, 4 for 4P). */
  lastCount: number;
  /** Average finishing rank — `totalRank / gameCount`. */
  averageRank: number;
  /** 1 位率 = `topCount / gameCount` (0..1, multiply for display). */
  topRate: number;
}

// ---------------------------------------------------------------------------
// P2 / P3 — Match 公開ページ
// ---------------------------------------------------------------------------

/**
 * Top-level P2 / P3 payload. Identical shape — P3 just resolves the Match by
 * a different lookup key (Match-level slug, not League slug + sequence
 * number). Today P3 always returns `null` because no Match-level slug exists
 * in the data model; see the file-level comment.
 */
export interface PublicMatchData {
  name: string;
  heldAt: string | null;
  memo: string | null;
  format: LeagueFormat;
  groupName: string;
  /**
   * `null` for League 外 Match (which today is purely theoretical for P3).
   * P2 always has both fields populated.
   */
  leagueName: string | null;
  leaguePublicSlug: string | null;
  sequenceNumber: number | null;
  defaultRuleset: PublicRulesetSummary | null;
  ranking: ReadonlyArray<PublicMatchRankingRow>;
  games: ReadonlyArray<PublicMatchGameRow>;
}

export interface PublicMatchRankingRow {
  playerId: string;
  playerName: string;
  gameCount: number;
  totalPoints: number;
  averagePoints: number;
  topCount: number;
  lastCount: number;
}

export interface PublicMatchGameRow {
  /** Stable key only — viewers cannot edit. */
  id: string;
  playedAt: string;
  rulesetName: string;
  results: ReadonlyArray<PublicMatchGameResultRow>;
}

export interface PublicMatchGameResultRow {
  playerId: string;
  playerName: string;
  rawScore: number;
  points: number;
  rank: number;
  tobiRole: TobiRole | null;
}

// ---------------------------------------------------------------------------
// P4 — 個人成績ページ
// ---------------------------------------------------------------------------

/**
 * Top-level P4 payload (`/l/:publicSlug/players/:playerId`).
 *
 * The page is scoped to one Player inside one League: aggregate totals plus
 * a Match-by-Match breakdown and the player's individual game history.
 */
export interface PublicPlayerData {
  playerId: string;
  playerName: string;
  leagueName: string;
  leaguePublicSlug: string;
  format: LeagueFormat;
  /** Aggregate指標 — Issue #23 calls out 対局数 / 平均ポイント / 1 位率 / 平均着順. */
  summary: PublicPlayerSummary;
  /** Per-Match breakdown — same metric shape, scoped to one Match each. */
  matches: ReadonlyArray<PublicPlayerMatchRow>;
  /**
   * Chronological game history (newest first). Each entry surfaces the
   * Player's own `rank` / `points` / `rawScore` plus a back-link to the
   * Match for context.
   */
  games: ReadonlyArray<PublicPlayerGameRow>;
}

export interface PublicPlayerSummary {
  gameCount: number;
  totalPoints: number;
  averagePoints: number;
  topCount: number;
  lastCount: number;
  topRate: number;
  averageRank: number;
}

export interface PublicPlayerMatchRow {
  matchId: string;
  matchName: string;
  sequenceNumber: number;
  heldAt: string | null;
  gameCount: number;
  totalPoints: number;
  averagePoints: number;
  topCount: number;
  lastCount: number;
}

export interface PublicPlayerGameRow {
  gameId: string;
  matchId: string;
  matchName: string;
  matchSequenceNumber: number;
  playedAt: string;
  rawScore: number;
  points: number;
  rank: number;
  tobiRole: TobiRole | null;
}
