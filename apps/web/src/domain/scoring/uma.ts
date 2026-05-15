/**
 * Uma table and per-rank lookup.
 *
 * Values come from `docs/docs/02-domain-model.md` § ウマパターン. The 3-player
 * patterns are the symmetric ±N / 0 / ∓N family confirmed in Issue #24.
 *
 * The table is exported as a frozen array so callers can (a) iterate it for
 * UI dropdowns and (b) be statically prevented from mutating it. `umaForRank`
 * is the only sanctioned read path — index access from the outside would lose
 * the rank-bounds check that catches "rank 4 in a 3-player game" bugs.
 *
 * Pure function module: no I/O, no clock, no randomness. Safe to import from
 * any layer (services, route loaders, tests).
 */

import type { UmaPattern } from '../../db/schema';

/**
 * Rank → uma value lookup table, indexed by `rank - 1`.
 *
 * Each entry has length 3 (3-player) or 4 (4-player). Frozen at module-load
 * time so a caller cannot accidentally mutate the table for the rest of the
 * process — a class of bug that would be very hard to track down across the
 * many call sites that read from here.
 */
export const UMA_VALUES: Record<UmaPattern, readonly number[]> = {
  // 4-player: ranks 1..4
  UMA_10_30: [30, 10, -10, -30],
  UMA_10_20: [20, 10, -10, -20],
  UMA_5_10: [10, 5, -5, -10],
  // 3-player: ranks 1..3, symmetric around 0 (Issue #24)
  UMA_3P_40: [40, 0, -40],
  UMA_3P_30: [30, 0, -30],
  UMA_3P_20: [20, 0, -20],
  UMA_3P_15: [15, 0, -15],
};

const FOUR_PLAYER_PATTERNS = new Set<UmaPattern>(['UMA_10_30', 'UMA_10_20', 'UMA_5_10']);
const THREE_PLAYER_PATTERNS = new Set<UmaPattern>([
  'UMA_3P_40',
  'UMA_3P_30',
  'UMA_3P_20',
  'UMA_3P_15',
]);

export const isFourPlayerUmaPattern = (pattern: UmaPattern): boolean =>
  FOUR_PLAYER_PATTERNS.has(pattern);

export const isThreePlayerUmaPattern = (pattern: UmaPattern): boolean =>
  THREE_PLAYER_PATTERNS.has(pattern);

/**
 * Returns the uma value for a given rank under a given pattern.
 *
 * Throws if `rank` is out of bounds for the pattern (e.g. rank 4 under a
 * 3-player pattern, or rank 0). The throw is intentional: an out-of-bounds
 * rank means the calling code already lost track of game format vs. ruleset,
 * and silently returning 0 would mask the upstream bug.
 *
 * Note: this returns the "base" uma for a given rank. Tied-rank handling
 * (均等割り) is the caller's responsibility — `ranking.ts` calls into this
 * function once per tied group and divides the sum.
 */
export const umaForRank = (pattern: UmaPattern, rank: number): number => {
  const table = UMA_VALUES[pattern];
  if (rank < 1 || rank > table.length) {
    throw new RangeError(
      `Rank ${rank} is out of bounds for uma pattern ${pattern} (1..${table.length})`,
    );
  }
  return table[rank - 1];
};
