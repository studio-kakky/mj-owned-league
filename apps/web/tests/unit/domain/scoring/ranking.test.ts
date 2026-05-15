import { describe, expect, it } from 'vitest';
import { rankWithUma } from '../../../../src/domain/scoring/ranking';

/**
 * Covers the two intertwined rules from `02-domain-model.md` § 順位ロジック (対局内):
 *
 *   1. rank = position in `rawScore desc`, with ties producing equal ranks
 *      and a *skipped* next rank (1, 2, 2, 4 — not 1, 2, 2, 3).
 *   2. Uma is shared evenly inside each tied group: the *sum* of the base
 *      uma values for the rank slots that the tied group occupies is split
 *      equally among its members.
 *
 * The function preserves input order so callers can zip the result back onto
 * the original player-id list without re-sorting.
 */
describe('rankWithUma — no ties (canonical case)', () => {
  it('assigns 1..4 to a strict-descending 4-player game', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [40000, 30000, 20000, 10000],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(result.map((r) => r.uma)).toEqual([30, 10, -10, -30]);
  });

  it('preserves input order in the output (does not sort)', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [10000, 40000, 20000, 30000],
    });

    // Input was [10000, 40000, 20000, 30000] → ranks are [4, 1, 3, 2]
    expect(result.map((r) => r.rank)).toEqual([4, 1, 3, 2]);
    expect(result.map((r) => r.uma)).toEqual([-30, 30, -10, 10]);
  });
});

describe('rankWithUma — tied ranks (同順位 + 次順位スキップ + ウマ均等割り)', () => {
  it('produces [1, 2, 2, 4] when two players tie for 2nd', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [40000, 30000, 30000, 0],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it('splits uma evenly inside a tied group (2 players sharing ranks 2+3 of UMA_10_30 → 0 each)', () => {
    // Base uma for ranks 2+3 under UMA_10_30 is +10 and -10, total 0, split → 0 each.
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [40000, 30000, 30000, 0],
    });

    expect(result.map((r) => r.uma)).toEqual([30, 0, 0, -30]);
  });

  it('produces [1, 1, 3, 4] when two players tie for 1st', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [35000, 35000, 20000, 10000],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 1, 3, 4]);
    // ranks 1+2 of UMA_10_30 = 30 + 10 = 40, split → 20 each
    expect(result.map((r) => r.uma)).toEqual([20, 20, -10, -30]);
  });

  it('produces [1, 1, 1, 4] when three players tie for 1st', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [25000, 25000, 25000, 25000 - 75000 / 3],
    });

    // Wait — rawScores must sum to startingScore × 4, but this function is
    // ranking-only. Use any rawScores that satisfy "3 tied at top". The
    // function doesn't enforce the sum invariant (that's integrity.ts).
    expect(result.map((r) => r.rank)).toEqual([1, 1, 1, 4]);
    // ranks 1+2+3 of UMA_10_30 = 30 + 10 + (-10) = 30, split / 3 → 10 each
    expect(result.map((r) => r.uma)).toEqual([10, 10, 10, -30]);
  });

  it('handles all 4 players tied — every uma is 0 because the table sums to 0', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [25000, 25000, 25000, 25000],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 1, 1, 1]);
    expect(result.map((r) => r.uma)).toEqual([0, 0, 0, 0]);
  });

  it('handles ties at the bottom — ranks [1, 2, 3, 3]', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_10_30',
      rawScores: [40000, 30000, 15000, 15000],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 2, 3, 3]);
    // ranks 3+4 of UMA_10_30 = -10 + -30 = -40, split → -20 each
    expect(result.map((r) => r.uma)).toEqual([30, 10, -20, -20]);
  });
});

describe('rankWithUma — 3-player games', () => {
  it('strict desc 3-player produces [1, 2, 3] with symmetric uma', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_3P_30',
      rawScores: [50000, 35000, 20000],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(result.map((r) => r.uma)).toEqual([30, 0, -30]);
  });

  it('all-tied 3-player game produces [1, 1, 1] with 0 uma each', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_3P_30',
      rawScores: [35000, 35000, 35000],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 1, 1]);
    expect(result.map((r) => r.uma)).toEqual([0, 0, 0]);
  });

  it('tied 2nd/3rd in a 3-player game → ranks [1, 2, 2], shared uma', () => {
    const result = rankWithUma({
      umaPattern: 'UMA_3P_30',
      rawScores: [50000, 27500, 27500],
    });

    expect(result.map((r) => r.rank)).toEqual([1, 2, 2]);
    // ranks 2+3 of UMA_3P_30 = 0 + -30 = -30, split → -15 each
    expect(result.map((r) => r.uma)).toEqual([30, -15, -15]);
  });
});

describe('rankWithUma — input validation', () => {
  it('throws when called with too many players for the pattern', () => {
    expect(() =>
      rankWithUma({
        umaPattern: 'UMA_3P_30',
        rawScores: [30000, 25000, 25000, 20000],
      }),
    ).toThrow();
  });

  it('throws when called with too few players for the pattern', () => {
    expect(() =>
      rankWithUma({
        umaPattern: 'UMA_10_30',
        rawScores: [30000, 25000, 25000],
      }),
    ).toThrow();
  });

  it('throws on an empty rawScores list', () => {
    expect(() =>
      rankWithUma({
        umaPattern: 'UMA_10_30',
        rawScores: [],
      }),
    ).toThrow();
  });
});
