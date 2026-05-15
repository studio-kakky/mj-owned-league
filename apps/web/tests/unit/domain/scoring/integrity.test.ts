import { describe, expect, it } from 'vitest';
import { assertRawScoreSum, ScoreMismatchError } from '../../../../src/domain/scoring/integrity';

/**
 * Covers the raw-score sum invariant from `02-domain-model.md` § GameResult:
 * `Σ rawScore === startingScore × 人数`. Violations surface as
 * `ScoreMismatchError` so a route handler can map it to a clean 4xx.
 */
describe('assertRawScoreSum', () => {
  it('accepts 4-player rows that sum to startingScore × 4', () => {
    expect(() =>
      assertRawScoreSum({
        startingScore: 25000,
        rawScores: [40000, 30000, 20000, 10000], // sum 100000
      }),
    ).not.toThrow();
  });

  it('accepts 3-player rows that sum to startingScore × 3', () => {
    expect(() =>
      assertRawScoreSum({
        startingScore: 35000,
        rawScores: [50000, 40000, 15000], // sum 105000
      }),
    ).not.toThrow();
  });

  it('throws ScoreMismatchError when the sum is off by even one point', () => {
    const thrown = (() => {
      try {
        assertRawScoreSum({
          startingScore: 25000,
          rawScores: [40000, 30000, 20000, 10001], // sum 100001 — off by one
        });
        return null;
      } catch (error) {
        return error;
      }
    })();

    expect(thrown).toBeInstanceOf(ScoreMismatchError);
    if (thrown instanceof ScoreMismatchError) {
      expect(thrown.expected).toBe(100000);
      expect(thrown.actual).toBe(100001);
    }
  });

  it('accepts negative rawScores as long as the sum is correct', () => {
    // Without a tobi rule, a player can finish below zero. The spec checks
    // only the sum invariant — we should not invent a "no negative" rule.
    expect(() =>
      assertRawScoreSum({
        startingScore: 25000,
        rawScores: [60000, 60000, -10000, -10000], // sum 100000
      }),
    ).not.toThrow();
  });

  it('throws on empty player list', () => {
    expect(() => assertRawScoreSum({ startingScore: 25000, rawScores: [] })).toThrow();
  });
});
