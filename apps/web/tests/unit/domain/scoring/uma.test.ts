import { describe, expect, it } from 'vitest';
import {
  isFourPlayerUmaPattern,
  isThreePlayerUmaPattern,
  UMA_VALUES,
  umaForRank,
} from '../../../../src/domain/scoring/uma';

/**
 * Exhaustively pins down every uma pattern from `02-domain-model.md` § ウマパターン.
 * Cross-checked against #24 (3-player uma values: ±N, 0, ∓N).
 *
 * If a future Issue adds a new pattern, the failure in this file is the loud
 * signal to update both the table and downstream code paths together.
 */
describe('umaForRank — 4-player patterns', () => {
  it('UMA_10_30 returns +30 / +10 / -10 / -30 for ranks 1..4', () => {
    expect(umaForRank('UMA_10_30', 1)).toBe(30);
    expect(umaForRank('UMA_10_30', 2)).toBe(10);
    expect(umaForRank('UMA_10_30', 3)).toBe(-10);
    expect(umaForRank('UMA_10_30', 4)).toBe(-30);
  });

  it('UMA_10_20 returns +20 / +10 / -10 / -20 for ranks 1..4', () => {
    expect(umaForRank('UMA_10_20', 1)).toBe(20);
    expect(umaForRank('UMA_10_20', 2)).toBe(10);
    expect(umaForRank('UMA_10_20', 3)).toBe(-10);
    expect(umaForRank('UMA_10_20', 4)).toBe(-20);
  });

  it('UMA_5_10 returns +10 / +5 / -5 / -10 for ranks 1..4', () => {
    expect(umaForRank('UMA_5_10', 1)).toBe(10);
    expect(umaForRank('UMA_5_10', 2)).toBe(5);
    expect(umaForRank('UMA_5_10', 3)).toBe(-5);
    expect(umaForRank('UMA_5_10', 4)).toBe(-10);
  });
});

describe('umaForRank — 3-player patterns (issue #24)', () => {
  it('UMA_3P_40 returns +40 / 0 / -40', () => {
    expect(umaForRank('UMA_3P_40', 1)).toBe(40);
    expect(umaForRank('UMA_3P_40', 2)).toBe(0);
    expect(umaForRank('UMA_3P_40', 3)).toBe(-40);
  });

  it('UMA_3P_30 returns +30 / 0 / -30', () => {
    expect(umaForRank('UMA_3P_30', 1)).toBe(30);
    expect(umaForRank('UMA_3P_30', 2)).toBe(0);
    expect(umaForRank('UMA_3P_30', 3)).toBe(-30);
  });

  it('UMA_3P_20 returns +20 / 0 / -20', () => {
    expect(umaForRank('UMA_3P_20', 1)).toBe(20);
    expect(umaForRank('UMA_3P_20', 2)).toBe(0);
    expect(umaForRank('UMA_3P_20', 3)).toBe(-20);
  });

  it('UMA_3P_15 returns +15 / 0 / -15', () => {
    expect(umaForRank('UMA_3P_15', 1)).toBe(15);
    expect(umaForRank('UMA_3P_15', 2)).toBe(0);
    expect(umaForRank('UMA_3P_15', 3)).toBe(-15);
  });
});

describe('umaForRank — guard rails', () => {
  it('throws when asked for rank 4 on a 3-player pattern', () => {
    expect(() => umaForRank('UMA_3P_40', 4)).toThrow();
  });

  it('throws when asked for rank 0 or negative', () => {
    expect(() => umaForRank('UMA_10_30', 0)).toThrow();
    expect(() => umaForRank('UMA_10_30', -1)).toThrow();
  });
});

describe('pattern predicates', () => {
  it('isFourPlayerUmaPattern is true for 4P patterns only', () => {
    expect(isFourPlayerUmaPattern('UMA_10_30')).toBe(true);
    expect(isFourPlayerUmaPattern('UMA_10_20')).toBe(true);
    expect(isFourPlayerUmaPattern('UMA_5_10')).toBe(true);
    expect(isFourPlayerUmaPattern('UMA_3P_40')).toBe(false);
  });

  it('isThreePlayerUmaPattern is true for 3P patterns only', () => {
    expect(isThreePlayerUmaPattern('UMA_3P_40')).toBe(true);
    expect(isThreePlayerUmaPattern('UMA_3P_15')).toBe(true);
    expect(isThreePlayerUmaPattern('UMA_10_30')).toBe(false);
  });
});

describe('UMA_VALUES table — sums to zero (so applying the full table is a zero-sum transfer)', () => {
  it.each(
    Object.keys(UMA_VALUES) as Array<keyof typeof UMA_VALUES>,
  )('%s sums to 0 across all ranks', (pattern) => {
    const values = UMA_VALUES[pattern];
    const sum = values.reduce((acc, v) => acc + v, 0);
    expect(sum).toBe(0);
  });
});
