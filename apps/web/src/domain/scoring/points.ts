/**
 * End-to-end per-Game points calculation.
 *
 * Implements `02-domain-model.md` § ポイント計算:
 *
 *   points = (rawScore − returnScore) / 1000
 *          + uma[rank]
 *          + (rank === 1 ? oka : 0)
 *          + tobiAdjustment
 *
 * Composes the lower-level modules in this folder:
 *
 *   - `integrity.assertRawScoreSum` — `Σ rawScore === startingScore × n`
 *   - `ranking.rankWithUma` — rank assignment + uma share for tied groups
 *   - `oka.okaTotal` — total oka pot
 *   - `uma.umaForRank` (transitively, via `ranking`)
 *
 * Oka distribution rule: split *evenly* across rank-1 ties (same rule the
 * spec gives for uma sharing). The spec is silent on oka splitting; we follow
 * "均等割り" because it keeps the math zero-sum across all tie shapes and
 * matches user intuition that a shared 1st place should share the pot too.
 *
 * Returns one entry per input player, in input order.
 *
 * Pure function. No I/O.
 */

import type { TobiRole, UmaPattern } from '../../db/schema';
import { DomainError } from '../../services/errors';
import { assertRawScoreSum } from './integrity';
import { okaTotal } from './oka';
import { rankWithUma } from './ranking';

export interface PointsRulesetInput {
  startingScore: number;
  returnScore: number;
  umaPattern: UmaPattern;
  tobiEnabled: boolean;
  /** Required iff `tobiEnabled === true`. Mirrors the Ruleset entity. */
  tobiPoint: number | null;
}

export interface PointsPlayerInput {
  rawScore: number;
  tobiRole: TobiRole | null;
}

export interface CalculateGamePointsInput {
  ruleset: PointsRulesetInput;
  players: readonly PointsPlayerInput[];
}

export interface PointsResultEntry {
  rank: number;
  points: number;
}

/**
 * Thrown when the supplied Ruleset is internally inconsistent in a way that
 * makes points calculation undefined. Mirrors the service-layer
 * `TobiConfigurationError` (different module to keep this file independent
 * of services) and uses the same `DomainError` ancestor so an HTTP boundary
 * can map both to 400.
 */
export class InvalidRulesetForCalculationError extends DomainError {}

export const calculateGamePoints = (input: CalculateGamePointsInput): PointsResultEntry[] => {
  const { ruleset, players } = input;

  // 1. Guard rails the lower-level modules don't catch on their own.
  if (ruleset.tobiEnabled && (ruleset.tobiPoint === null || ruleset.tobiPoint === undefined)) {
    throw new InvalidRulesetForCalculationError('tobiPoint must be set when tobiEnabled is true');
  }

  // 2. Raw-score sum invariant. Throws ScoreMismatchError on failure.
  const rawScores = players.map((p) => p.rawScore);
  assertRawScoreSum({ startingScore: ruleset.startingScore, rawScores });

  // 3. Ranks + per-player uma share (handles ties).
  const ranked = rankWithUma({ umaPattern: ruleset.umaPattern, rawScores });

  // 4. Oka. Split evenly across the rank-1 players (handles tied 1st).
  const okaPot = okaTotal({
    startingScore: ruleset.startingScore,
    returnScore: ruleset.returnScore,
    players: players.length,
  });
  const rankOneCount = ranked.reduce((acc, r) => acc + (r.rank === 1 ? 1 : 0), 0);
  // `rankOneCount` is at least 1 because `rankWithUma` always assigns rank 1.
  // The division is therefore safe.
  const okaPerRankOne = okaPot / rankOneCount;

  // 5. Tobi adjustment. Only applied when the ruleset opts in; stray
  // `tobiRole` values on the input are ignored otherwise (UI rule-changes
  // can leave them dangling).
  const tobiPointValue = ruleset.tobiEnabled ? (ruleset.tobiPoint ?? 0) : 0;

  // 6. Sum the parts per player.
  return players.map((player, i) => {
    const rank = ranked[i].rank;
    const umaShare = ranked[i].uma;
    const base = (player.rawScore - ruleset.returnScore) / 1000;
    const okaShare = rank === 1 ? okaPerRankOne : 0;

    let tobiAdj = 0;
    if (ruleset.tobiEnabled && player.tobiRole !== null) {
      if (player.tobiRole === 'INFLICTOR') tobiAdj = tobiPointValue;
      else if (player.tobiRole === 'VICTIM') tobiAdj = -tobiPointValue;
    }

    return {
      rank,
      points: base + umaShare + okaShare + tobiAdj,
    };
  });
};
