/**
 * GameService — CRUD for `games`, plus the matchId/leagueId integrity rule
 * from `02-domain-model.md` § Game.
 *
 * Rule (verbatim from the domain doc): when both `matchId` and `leagueId` are
 * set on a Game, `game.leagueId` must equal the parent Match's `leagueId`.
 * The four allowed combinations (per the table in § Game の所属パターン):
 *
 *   matchId | leagueId | OK?
 *   --------+----------+--------------------------------
 *   null    | null     | yes — Group-direct casual game
 *   null    | set      | yes — single Game under a League
 *   set     | null     | yes — Match exists outside any League;
 *                              Match.leagueId MUST also be null
 *   set     | set      | yes IFF game.leagueId === match.leagueId
 *
 * The two illegal shapes are (matchId set, leagueId set, mismatch) and
 * (matchId set, leagueId null, but match.leagueId is non-null). Both surface
 * as `GameMatchLeagueMismatchError`.
 *
 * The result-related rules from `02-domain-model.md` § GameResult (raw-score
 * sum = startingScore × players; rank derives from rawScore desc; etc.) are
 * NOT in this service — they sit on GameResultService alongside the score
 * calculator, which is the natural transaction boundary for a "submit a
 * Game's full result" call.
 */

import type { Game, NewGame } from '../db/schema';
import type { GameRepository, MatchRepository } from '../repositories/interfaces';
import { EntityNotFoundError, GameMatchLeagueMismatchError } from './errors';

export class GameService {
  constructor(
    private readonly gameRepo: GameRepository,
    private readonly matchRepo: MatchRepository,
  ) {}

  findById(id: string): Promise<Game | null> {
    return this.gameRepo.findById(id);
  }

  listByGroup(groupId: string): Promise<Game[]> {
    return this.gameRepo.listByGroup(groupId);
  }

  listByMatch(matchId: string): Promise<Game[]> {
    return this.gameRepo.listByMatch(matchId);
  }

  listByLeague(leagueId: string): Promise<Game[]> {
    return this.gameRepo.listByLeague(leagueId);
  }

  async create(input: NewGame): Promise<Game> {
    await this.assertMatchLeagueConsistent(input.matchId ?? null, input.leagueId ?? null);
    return this.gameRepo.create(input);
  }

  async update(id: string, input: Partial<Omit<NewGame, 'id'>>): Promise<Game | null> {
    // Only re-run the consistency check when the caller is touching one of
    // the relevant fields; otherwise we'd pay the cost on every name / memo
    // update.
    if ('matchId' in input || 'leagueId' in input) {
      const existing = await this.gameRepo.findById(id);
      if (existing === null) {
        return null;
      }
      const nextMatchId = 'matchId' in input ? (input.matchId ?? null) : existing.matchId;
      const nextLeagueId = 'leagueId' in input ? (input.leagueId ?? null) : existing.leagueId;
      await this.assertMatchLeagueConsistent(nextMatchId, nextLeagueId);
    }
    return this.gameRepo.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.gameRepo.delete(id);
  }

  /**
   * Centralised guard for the matchId/leagueId pair. Extracted so both
   * `create` and `update` use byte-for-byte the same check.
   */
  private async assertMatchLeagueConsistent(
    matchId: string | null,
    leagueId: string | null,
  ): Promise<void> {
    if (matchId === null) {
      // Both shapes with matchId=null are always legal regardless of leagueId.
      return;
    }
    const match = await this.matchRepo.findById(matchId);
    if (match === null) {
      throw new EntityNotFoundError('Match', matchId);
    }
    if (match.leagueId !== leagueId) {
      throw new GameMatchLeagueMismatchError(leagueId, match.leagueId);
    }
  }
}
