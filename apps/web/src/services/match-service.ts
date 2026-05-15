/**
 * MatchService — CRUD for the `matches` entity.
 *
 * Cross-table rule held here: when a Match is updated to set / change its
 * `leagueId`, any already-attached Games inherit the constraint
 * "game.leagueId must equal match.leagueId" from `02-domain-model.md` § Game.
 * In MVP we do NOT cascade — re-pointing a Match's League while Games are
 * already attached is rejected by raising the same `GameMatchLeagueMismatchError`
 * the GameService uses, because the alternative (silently moving all Games)
 * is harder to reason about for an audit-style domain like this one.
 *
 * Implementing that cascade-check requires reading the Match's existing Games
 * during update, which forces this service to take a `GameRepository` as well.
 * That coupling is intentional: the rule lives at the boundary where both
 * entities meet.
 */

import type { Match, NewMatch } from '../db/schema';
import type { GameRepository, MatchRepository } from '../repositories/interfaces';
import { GameMatchLeagueMismatchError } from './errors';

export class MatchService {
  constructor(
    private readonly matchRepo: MatchRepository,
    private readonly gameRepo: GameRepository,
  ) {}

  findById(id: string): Promise<Match | null> {
    return this.matchRepo.findById(id);
  }

  listByGroup(groupId: string): Promise<Match[]> {
    return this.matchRepo.listByGroup(groupId);
  }

  listByLeague(leagueId: string): Promise<Match[]> {
    return this.matchRepo.listByLeague(leagueId);
  }

  create(input: NewMatch): Promise<Match> {
    return this.matchRepo.create(input);
  }

  async update(id: string, input: Partial<Omit<NewMatch, 'id'>>): Promise<Match | null> {
    // Only run the cross-check when the caller is actually trying to move
    // the Match between Leagues. Other updates (name, memo, sequenceNumber)
    // are unaffected.
    if ('leagueId' in input) {
      const existing = await this.matchRepo.findById(id);
      if (existing === null) {
        return null;
      }
      const nextLeagueId = input.leagueId ?? null;
      if (nextLeagueId !== existing.leagueId) {
        const attachedGames = await this.gameRepo.listByMatch(id);
        for (const game of attachedGames) {
          // A game with leagueId=null was fine under the old match-leagueId;
          // it would still be fine if the new leagueId is also null, but the
          // moment we set a non-null leagueId we'd violate the rule for it.
          if (game.leagueId !== nextLeagueId) {
            throw new GameMatchLeagueMismatchError(game.leagueId, nextLeagueId);
          }
        }
      }
    }
    return this.matchRepo.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.matchRepo.delete(id);
  }
}
