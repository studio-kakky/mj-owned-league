/**
 * Game-result integrity checks.
 *
 * From `docs/docs/02-domain-model.md` § GameResult:
 *
 *     整合性検証: 同 Game 内の rawScore 合計 === startingScore × 人数
 *
 * The check is mechanical but easy to forget at every save site, so it lives
 * here as a single named function plus a typed error. Service callers
 * (eventually `GameResultService.replaceForGame`) should call this before
 * persisting; route handlers can map the error to a 400.
 *
 * Pure function module. No I/O.
 */

import { DomainError } from '../../services/errors';

export interface RawScoreSumInput {
  startingScore: number;
  rawScores: readonly number[];
}

/**
 * Thrown when the sum of `rawScore` across a Game's players does not equal
 * `startingScore × players`. Carries both numbers so error UIs / logs can
 * show "expected 100000, got 100001" without re-running the computation.
 */
export class ScoreMismatchError extends DomainError {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(`Raw score sum ${actual} does not match expected ${expected}`);
  }
}

export const assertRawScoreSum = (input: RawScoreSumInput): void => {
  if (input.rawScores.length === 0) {
    throw new RangeError('rawScores must not be empty');
  }
  const expected = input.startingScore * input.rawScores.length;
  // Reducing with an explicit seed of 0 keeps the type narrow even on
  // readonly arrays (TS would otherwise widen if we let it pick the seed).
  const actual = input.rawScores.reduce<number>((acc, score) => acc + score, 0);
  if (actual !== expected) {
    throw new ScoreMismatchError(expected, actual);
  }
};
