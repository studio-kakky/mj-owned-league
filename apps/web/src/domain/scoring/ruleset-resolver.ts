/**
 * Ruleset resolution order.
 *
 * From `docs/docs/02-domain-model.md` § Ruleset の解決順序:
 *
 *   1. Game.rulesetId (if the caller specified one at submit time)
 *   2. else Match.defaultRulesetId
 *   3. else League.defaultRulesetId
 *   4. else Group.defaultRulesetId
 *
 * If all four levels are empty, that's a data-integrity violation (the spec
 * states Group creation should always seed a default), so we throw rather
 * than silently fall back to something arbitrary.
 *
 * Note: this resolves a *Ruleset ID*, not a Ruleset row. Loading the row is
 * the service caller's job (the ID may live in a different repository call).
 * Keeping the resolver narrow means it stays a pure function with no Promise
 * surface — easy to test, easy to compose into a Service method that already
 * has the IDs to hand.
 */

import { DomainError } from '../../services/errors';

/** A value the resolver treats as "no ruleset configured at this level". */
type Optional<T> = T | null | undefined;

export interface ResolveRulesetInput {
  /** Explicitly chosen at Game submit time. Highest priority. */
  gameRulesetId: Optional<string>;
  /** Default ruleset on the Game's parent Match (if any). */
  matchDefaultRulesetId: Optional<string>;
  /** Default ruleset on the Game's parent League (if any). */
  leagueDefaultRulesetId: Optional<string>;
  /** Default ruleset on the Game's Group. Last fallback. */
  groupDefaultRulesetId: Optional<string>;
}

export class RulesetResolutionError extends DomainError {
  constructor() {
    super('No ruleset could be resolved (Game / Match / League / Group all empty)');
  }
}

export const resolveRulesetId = (input: ResolveRulesetInput): string => {
  const candidates: Array<Optional<string>> = [
    input.gameRulesetId,
    input.matchDefaultRulesetId,
    input.leagueDefaultRulesetId,
    input.groupDefaultRulesetId,
  ];
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }
  throw new RulesetResolutionError();
};
