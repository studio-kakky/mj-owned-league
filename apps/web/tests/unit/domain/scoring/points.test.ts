import { describe, expect, it } from 'vitest';
import { ScoreMismatchError } from '../../../../src/domain/scoring/integrity';
import { calculateGamePoints } from '../../../../src/domain/scoring/points';

/**
 * End-to-end pin of the points formula from `02-domain-model.md` § ポイント計算:
 *
 *   points = (rawScore − returnScore) / 1000
 *          + uma[rank]
 *          + (rank === 1 ? oka : 0)
 *          + tobiAdjustment
 *
 * Where:
 *   - oka = (returnScore − startingScore) × players / 1000  (split among rank-1 ties)
 *   - tobiAdjustment: ±tobiPoint when tobiEnabled, by `INFLICTOR` / `VICTIM`
 *
 * The function also re-runs the raw-score sum invariant before computing,
 * because callers (services, route handlers) treat point calculation as the
 * single boundary that says "ok, save this".
 */
describe('calculateGamePoints — canonical 4-player game', () => {
  it('25000-start / 30000-return / UMA_10_30 / no tobi', () => {
    // Raw scores chosen so the sum is 100000 (= 25000 × 4):
    //   40000 / 30000 / 20000 / 10000
    //
    // Per-player breakdown (points = (raw − return)/1000 + uma + oka + tobi):
    //   Rank 1: (40000 − 30000)/1000 + 30 + 20 +  0 = 10 + 30 + 20 = 60
    //   Rank 2: (30000 − 30000)/1000 + 10 +  0 +  0 =  0 + 10      = 10
    //   Rank 3: (20000 − 30000)/1000 + (-10) + 0 + 0 = -10 - 10    = -20
    //   Rank 4: (10000 − 30000)/1000 + (-30) + 0 + 0 = -20 - 30    = -50
    //
    // Sum: 60 + 10 + (-20) + (-50) = 0 — zero-sum, which is the headline
    // sanity check.
    const result = calculateGamePoints({
      ruleset: {
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: false,
        tobiPoint: null,
      },
      players: [
        { rawScore: 40000, tobiRole: null },
        { rawScore: 30000, tobiRole: null },
        { rawScore: 20000, tobiRole: null },
        { rawScore: 10000, tobiRole: null },
      ],
    });

    expect(result.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
    expect(result.map((p) => p.points)).toEqual([60, 10, -20, -50]);

    const total = result.reduce((acc, p) => acc + p.points, 0);
    expect(total).toBe(0);
  });
});

describe('calculateGamePoints — ties', () => {
  it('two players tied for 2nd → ranks [1, 2, 2, 4], shared 0 uma', () => {
    // raw 40000 / 30000 / 30000 / 0  (sum 100000)
    //
    //   Rank 1: 10 + 30 + 20 = 60
    //   Rank 2 (tied a): 0 + 0 + 0 = 0     (umaShare for slots 2+3 = (10 + -10)/2 = 0)
    //   Rank 2 (tied b): 0 + 0 + 0 = 0
    //   Rank 4: (0 − 30000)/1000 + (-30) = -30 - 30 = -60
    const result = calculateGamePoints({
      ruleset: {
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: false,
        tobiPoint: null,
      },
      players: [
        { rawScore: 40000, tobiRole: null },
        { rawScore: 30000, tobiRole: null },
        { rawScore: 30000, tobiRole: null },
        { rawScore: 0, tobiRole: null },
      ],
    });

    expect(result.map((p) => p.rank)).toEqual([1, 2, 2, 4]);
    expect(result.map((p) => p.points)).toEqual([60, 0, 0, -60]);
  });

  it('two players tied for 1st → oka splits between them', () => {
    // raw 35000 / 35000 / 20000 / 10000 (sum 100000)
    //
    // Oka total = 20.  Both rank-1 players get oka/2 = 10.
    // Uma slots 1+2 of UMA_10_30 = 30 + 10 = 40, split → 20 each.
    //
    //   Rank 1 (a): (35000 − 30000)/1000 + 20 + 10 + 0 = 5 + 20 + 10 = 35
    //   Rank 1 (b): same as above = 35
    //   Rank 3: (20000 − 30000)/1000 + (-10) + 0 + 0 = -20
    //   Rank 4: (10000 − 30000)/1000 + (-30) + 0 + 0 = -50
    const result = calculateGamePoints({
      ruleset: {
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: false,
        tobiPoint: null,
      },
      players: [
        { rawScore: 35000, tobiRole: null },
        { rawScore: 35000, tobiRole: null },
        { rawScore: 20000, tobiRole: null },
        { rawScore: 10000, tobiRole: null },
      ],
    });

    expect(result.map((p) => p.rank)).toEqual([1, 1, 3, 4]);
    expect(result.map((p) => p.points)).toEqual([35, 35, -20, -50]);

    const total = result.reduce((acc, p) => acc + p.points, 0);
    expect(total).toBe(0);
  });
});

describe('calculateGamePoints — tobi (飛び賞)', () => {
  it('adds +tobiPoint to the INFLICTOR and -tobiPoint to the VICTIM', () => {
    // raw 60000 / 30000 / 20000 / -10000 (sum 100000)
    // tobi pt = 10.  Rank 1 caused the busto, rank 4 got busted.
    //
    //   Rank 1 (INFLICTOR): (60000 − 30000)/1000 + 30 + 20 + 10 = 30 + 30 + 20 + 10 = 90
    //   Rank 2:             (30000 − 30000)/1000 + 10 + 0 + 0   = 10
    //   Rank 3:             (20000 − 30000)/1000 + (-10) + 0 + 0 = -10 - 10 = -20
    //   Rank 4 (VICTIM):    (-10000 − 30000)/1000 + (-30) + 0 + (-10) = -40 - 30 - 10 = -80
    const result = calculateGamePoints({
      ruleset: {
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: true,
        tobiPoint: 10,
      },
      players: [
        { rawScore: 60000, tobiRole: 'INFLICTOR' },
        { rawScore: 30000, tobiRole: null },
        { rawScore: 20000, tobiRole: null },
        { rawScore: -10000, tobiRole: 'VICTIM' },
      ],
    });

    expect(result.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
    expect(result.map((p) => p.points)).toEqual([90, 10, -20, -80]);

    const total = result.reduce((acc, p) => acc + p.points, 0);
    expect(total).toBe(0);
  });

  it('ignores tobi roles when tobiEnabled=false (defensive)', () => {
    // Same setup as canonical but a stray tobiRole is left over from a UI
    // that didn't clean up after a rule change. We should ignore it.
    const result = calculateGamePoints({
      ruleset: {
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: false,
        tobiPoint: null,
      },
      players: [
        { rawScore: 40000, tobiRole: 'INFLICTOR' },
        { rawScore: 30000, tobiRole: null },
        { rawScore: 20000, tobiRole: null },
        { rawScore: 10000, tobiRole: 'VICTIM' },
      ],
    });

    expect(result.map((p) => p.points)).toEqual([60, 10, -20, -50]);
  });
});

describe('calculateGamePoints — 3-player game', () => {
  it('35000-start / 40000-return / UMA_3P_30 / no tobi', () => {
    // 3-player oka: (40000 − 35000) × 3 / 1000 = 15.  Goes to rank 1.
    // raw 50000 / 35000 / 20000 (sum 105000 = 35000 × 3)
    //
    //   Rank 1: (50000 − 40000)/1000 + 30 + 15 + 0 = 10 + 30 + 15 = 55
    //   Rank 2: (35000 − 40000)/1000 +  0 +  0 + 0 = -5
    //   Rank 3: (20000 − 40000)/1000 + (-30) + 0 + 0 = -20 - 30 = -50
    //
    // Sum: 55 - 5 - 50 = 0
    const result = calculateGamePoints({
      ruleset: {
        startingScore: 35000,
        returnScore: 40000,
        umaPattern: 'UMA_3P_30',
        tobiEnabled: false,
        tobiPoint: null,
      },
      players: [
        { rawScore: 50000, tobiRole: null },
        { rawScore: 35000, tobiRole: null },
        { rawScore: 20000, tobiRole: null },
      ],
    });

    expect(result.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(result.map((p) => p.points)).toEqual([55, -5, -50]);
  });
});

describe('calculateGamePoints — invariants', () => {
  it('throws ScoreMismatchError when rawScores do not sum to startingScore × players', () => {
    expect(() =>
      calculateGamePoints({
        ruleset: {
          startingScore: 25000,
          returnScore: 30000,
          umaPattern: 'UMA_10_30',
          tobiEnabled: false,
          tobiPoint: null,
        },
        players: [
          { rawScore: 40000, tobiRole: null },
          { rawScore: 30000, tobiRole: null },
          { rawScore: 20000, tobiRole: null },
          { rawScore: 10001, tobiRole: null }, // sum off by 1
        ],
      }),
    ).toThrow(ScoreMismatchError);
  });

  it('throws when tobiEnabled=true but tobiPoint is null', () => {
    expect(() =>
      calculateGamePoints({
        ruleset: {
          startingScore: 25000,
          returnScore: 30000,
          umaPattern: 'UMA_10_30',
          tobiEnabled: true,
          tobiPoint: null,
        },
        players: [
          { rawScore: 40000, tobiRole: 'INFLICTOR' },
          { rawScore: 30000, tobiRole: null },
          { rawScore: 20000, tobiRole: null },
          { rawScore: 10000, tobiRole: 'VICTIM' },
        ],
      }),
    ).toThrow();
  });

  it('throws when player count does not match the uma pattern arity', () => {
    expect(() =>
      calculateGamePoints({
        ruleset: {
          startingScore: 25000,
          returnScore: 30000,
          umaPattern: 'UMA_10_30', // expects 4 players
          tobiEnabled: false,
          tobiPoint: null,
        },
        players: [
          { rawScore: 50000, tobiRole: null },
          { rawScore: 35000, tobiRole: null },
          { rawScore: 20000, tobiRole: null },
        ],
      }),
    ).toThrow();
  });
});
