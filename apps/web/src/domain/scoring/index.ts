/**
 * Barrel module for the `scoring` domain folder.
 *
 * Services and route loaders should import from here so the per-rule files
 * (oka.ts, ranking.ts, …) can be reorganised without rippling through call
 * sites. The names are export-as-is for easy grep-ability — no aliasing.
 */

export type { RawScoreSumInput } from './integrity';
export { assertRawScoreSum, ScoreMismatchError } from './integrity';
export type { OkaInput } from './oka';
export { okaTotal } from './oka';

export type {
  CalculateGamePointsInput,
  PointsPlayerInput,
  PointsResultEntry,
  PointsRulesetInput,
} from './points';
export { calculateGamePoints, InvalidRulesetForCalculationError } from './points';
export type { RankedEntry, RankWithUmaInput } from './ranking';
export { rankWithUma } from './ranking';
export type { ResolveRulesetInput } from './ruleset-resolver';
export { RulesetResolutionError, resolveRulesetId } from './ruleset-resolver';

export {
  isFourPlayerUmaPattern,
  isThreePlayerUmaPattern,
  UMA_VALUES,
  umaForRank,
} from './uma';
