/**
 * RulesetService — CRUD for the `rulesets` entity.
 *
 * The `tobiEnabled` / `tobiPoint` interdependency described in
 * `02-domain-model.md` § Ruleset is enforced here at the service boundary
 * rather than in the Zod schema. Keeping all integrity rules in services
 * gives us a single place to look when answering "why was my write rejected?",
 * even though the rule is a single-record one that Zod could express.
 *
 * The uma-pattern ↔ league-format compatibility check (e.g. `UMA_3P_*` only
 * with a `3P_*` league) is NOT enforced here. A Ruleset belongs to a Group,
 * not a League — the same Ruleset could in principle be used by multiple
 * Leagues of differing formats. The check belongs at the point of Game
 * creation, where both Ruleset and format are known together.
 */

import type { NewRuleset, Ruleset } from '../db/schema';
import type { RulesetRepository } from '../repositories/interfaces';
import { DomainError } from './errors';

class TobiConfigurationError extends DomainError {}

const assertTobiConsistent = (input: Pick<NewRuleset, 'tobiEnabled' | 'tobiPoint'>): void => {
  if (input.tobiEnabled === true && (input.tobiPoint === null || input.tobiPoint === undefined)) {
    throw new TobiConfigurationError('tobiPoint must be set when tobiEnabled is true');
  }
  if (input.tobiEnabled === false && input.tobiPoint !== null && input.tobiPoint !== undefined) {
    throw new TobiConfigurationError('tobiPoint must be null when tobiEnabled is false');
  }
};

export class RulesetService {
  constructor(private readonly repo: RulesetRepository) {}

  findById(id: string): Promise<Ruleset | null> {
    return this.repo.findById(id);
  }

  listByGroup(groupId: string): Promise<Ruleset[]> {
    return this.repo.listByGroup(groupId);
  }

  async create(input: NewRuleset): Promise<Ruleset> {
    // `async` here is load-bearing: `assertTobiConsistent` throws
    // synchronously, and we want that surfaced as a rejected Promise so
    // callers can use a uniform `try { await ... }` pattern at the call site.
    assertTobiConsistent(input);
    return this.repo.create(input);
  }

  async update(id: string, input: Partial<Omit<NewRuleset, 'id'>>): Promise<Ruleset | null> {
    // For updates we need the existing row to evaluate the rule against the
    // post-update state (e.g. flipping `tobiEnabled` while leaving `tobiPoint`
    // alone). If the row doesn't exist we let the repo's `update` return null.
    const existing = await this.repo.findById(id);
    if (existing === null) {
      return null;
    }
    const merged: Pick<NewRuleset, 'tobiEnabled' | 'tobiPoint'> = {
      tobiEnabled: input.tobiEnabled ?? existing.tobiEnabled,
      tobiPoint: input.tobiPoint === undefined ? existing.tobiPoint : input.tobiPoint,
    };
    assertTobiConsistent(merged);
    return this.repo.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}

export { TobiConfigurationError };
