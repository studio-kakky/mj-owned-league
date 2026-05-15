/**
 * GameResultService — bulk CRUD for `game_results`.
 *
 * Issue #9 scope is CRUD-level only; the full score-calculation pipeline
 * (raw-score sum invariant, points / rank derivation from the resolved
 * Ruleset, tobi adjustment, tie-breaking) belongs to the calculation issue
 * that follows. That keeps this service's surface small and lets the
 * calculator be unit-tested in isolation as a pure function against typed
 * inputs.
 *
 * The two methods exposed here are deliberately bulk-only (`createMany`,
 * `replaceForGame`) because the domain doc states every Game has exactly
 * `format`-many results, so a per-row create / update API would invite
 * inconsistent intermediate states.
 */

import type { GameResult, NewGameResult } from '../db/schema';
import type { GameResultRepository } from '../repositories/interfaces';

export class GameResultService {
  constructor(private readonly repo: GameResultRepository) {}

  listByGame(gameId: string): Promise<GameResult[]> {
    return this.repo.listByGame(gameId);
  }

  createMany(inputs: NewGameResult[]): Promise<GameResult[]> {
    return this.repo.createMany(inputs);
  }

  replaceForGame(gameId: string, inputs: NewGameResult[]): Promise<GameResult[]> {
    return this.repo.replaceForGame(gameId, inputs);
  }

  deleteByGame(gameId: string): Promise<number> {
    return this.repo.deleteByGame(gameId);
  }
}
