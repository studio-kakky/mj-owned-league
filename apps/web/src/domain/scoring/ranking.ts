/**
 * Per-game rank assignment + uma share calculation.
 *
 * Implements the two rules from `docs/docs/02-domain-model.md` § 順位ロジック
 * (対局内):
 *
 *   1. Rank is the position in `rawScore` descending. Ties produce *equal*
 *      ranks and the next position is skipped (e.g. 40 / 30 / 30 / 10 →
 *      [1, 2, 2, 4], NOT [1, 2, 2, 3]).
 *   2. Inside a tied group, the *sum* of the base uma values for the rank
 *      slots the group occupies is split evenly across its members.
 *
 * The output preserves input order — callers (typically a Game submit handler)
 * already hold a `playerIds` array in their preferred order, and we don't want
 * to force a re-pair against sorted output.
 *
 * Pure function. No I/O.
 */

import type { UmaPattern } from '../../db/schema';
import { UMA_VALUES, umaForRank } from './uma';

export interface RankWithUmaInput {
  umaPattern: UmaPattern;
  /**
   * Raw scores in player-input order. The function does NOT enforce the
   * sum invariant (`Σ rawScore === startingScore × 人数`) — that's
   * `integrity.assertRawScoreSum`'s job, called separately before / during
   * persistence. Keeping the two checks split lets callers reuse rank logic
   * for "what-if" previews.
   */
  rawScores: readonly number[];
}

export interface RankedEntry {
  rank: number;
  /** Uma already accounting for any tie-split, ready to add to points. */
  uma: number;
}

/**
 * Row length in `UMA_VALUES` is the expected player count for a pattern.
 * Computing it (rather than hardcoding 3 / 4) keeps the door open for the
 * future-pattern row noted in the spec without touching this file.
 */
const expectedPlayerCount = (pattern: UmaPattern): number => UMA_VALUES[pattern].length;

export const rankWithUma = (input: RankWithUmaInput): RankedEntry[] => {
  const expected = expectedPlayerCount(input.umaPattern);

  if (input.rawScores.length === 0) {
    throw new RangeError('rawScores must not be empty');
  }
  if (input.rawScores.length !== expected) {
    throw new RangeError(
      `Uma pattern ${input.umaPattern} expects ${expected} players, got ${input.rawScores.length}`,
    );
  }

  // Sort *indices* by descending score so we can map ranks back to original
  // positions in one pass. Stable secondary key (index asc) keeps the walk
  // deterministic when scores tie — useful for predictable test output, even
  // though every tied member gets the same rank anyway.
  const indices = input.rawScores.map((_, i) => i);
  indices.sort((a, b) => {
    if (input.rawScores[b] !== input.rawScores[a]) {
      return input.rawScores[b] - input.rawScores[a];
    }
    return a - b;
  });

  const ranks = new Array<number>(input.rawScores.length);
  const umaByIndex = new Array<number>(input.rawScores.length);

  let position = 0; // 0-indexed sorted position; rank = position + 1
  while (position < indices.length) {
    const groupStart = position;
    const score = input.rawScores[indices[groupStart]];

    // Walk forward while scores are tied.
    let groupEnd = groupStart;
    while (groupEnd + 1 < indices.length && input.rawScores[indices[groupEnd + 1]] === score) {
      groupEnd += 1;
    }

    // Every member of [groupStart..groupEnd] gets rank = groupStart + 1.
    // The next position to assign starts at groupEnd + 1 — that's the
    // "skip next rank" rule (e.g. two players at rank 2 means no rank 3).
    const sharedRank = groupStart + 1;
    const groupSize = groupEnd - groupStart + 1;

    // Uma share = (sum of base uma over occupied rank slots) / groupSize.
    // Summing before dividing keeps integer values when the divisor matches
    // the slot sum's GCD (e.g. ranks 2+3 of UMA_10_30 sum to 0 → 0 each).
    let umaSum = 0;
    for (let slot = groupStart + 1; slot <= groupEnd + 1; slot += 1) {
      umaSum += umaForRank(input.umaPattern, slot);
    }
    const umaShare = umaSum / groupSize;

    for (let i = groupStart; i <= groupEnd; i += 1) {
      const originalIndex = indices[i];
      ranks[originalIndex] = sharedRank;
      umaByIndex[originalIndex] = umaShare;
    }

    position = groupEnd + 1;
  }

  return ranks.map((rank, i) => ({ rank, uma: umaByIndex[i] }));
};
