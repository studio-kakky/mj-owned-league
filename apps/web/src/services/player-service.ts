/**
 * PlayerService — CRUD plus the "history-aware delete" rule from
 * `02-domain-model.md` § Player.
 *
 * The rule: a Player that already appears in at least one `GameResult` row
 * cannot be physically deleted, because removing them would silently rewrite
 * historical game records. The expected fallback is to set `isActive = false`
 * (the explicit "retirement" path called out in the domain doc).
 *
 * We surface that as the dedicated `deactivate(id)` method here so the
 * route / server-function layer can offer a clean two-button UX
 * ("delete" / "deactivate") without re-deriving the rule.
 */

import type { NewPlayer, Player } from '../db/schema';
import type { PlayerRepository } from '../repositories/interfaces';
import { PlayerHasHistoryError } from './errors';

export class PlayerService {
  constructor(private readonly repo: PlayerRepository) {}

  findById(id: string): Promise<Player | null> {
    return this.repo.findById(id);
  }

  listByGroup(groupId: string): Promise<Player[]> {
    return this.repo.listByGroup(groupId);
  }

  create(input: NewPlayer): Promise<Player> {
    return this.repo.create(input);
  }

  update(id: string, input: Partial<Omit<NewPlayer, 'id'>>): Promise<Player | null> {
    return this.repo.update(id, input);
  }

  /**
   * Physically deletes the Player only when no `GameResult` references it.
   * Throws `PlayerHasHistoryError` otherwise; the caller is expected to call
   * `deactivate()` instead in that case.
   */
  async delete(id: string): Promise<boolean> {
    if (await this.repo.hasGameHistory(id)) {
      throw new PlayerHasHistoryError(id);
    }
    return this.repo.delete(id);
  }

  /**
   * Soft-retirement: sets `isActive = false`. The UI prevents `isActive = false`
   * players from being added to new Games (`02-domain-model.md` § Player).
   */
  deactivate(id: string): Promise<Player | null> {
    return this.repo.update(id, { isActive: false });
  }

  /** Inverse of `deactivate` — re-enables a previously retired Player. */
  reactivate(id: string): Promise<Player | null> {
    return this.repo.update(id, { isActive: true });
  }
}
