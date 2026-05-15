import { beforeEach, describe, expect, it } from 'vitest';
import { EntityNotFoundError, GameMatchLeagueMismatchError } from '../../../src/services/errors';
import { GameService } from '../../../src/services/game-service';
import { FakeGameRepository, FakeMatchRepository } from './fakes';

/**
 * Covers the Game integrity rule from `02-domain-model.md` § Game:
 * when `matchId` is set, `game.leagueId` MUST equal `match.leagueId`
 * (with `null` treated as a value, not "any").
 */
describe('GameService', () => {
  let gameRepo: FakeGameRepository;
  let matchRepo: FakeMatchRepository;
  let service: GameService;

  beforeEach(() => {
    gameRepo = new FakeGameRepository();
    matchRepo = new FakeMatchRepository();
    service = new GameService(gameRepo, matchRepo);
  });

  const baseGame = {
    id: 'game-1',
    groupId: 'g1',
    format: '4P_HANCHAN' as const,
    rulesetId: 'r1',
    playedAt: '2026-05-15T00:00:00.000Z',
  };

  describe('create — matchId/leagueId pairs', () => {
    it('accepts (matchId=null, leagueId=null) — Group-direct casual game', async () => {
      const created = await service.create({
        ...baseGame,
        matchId: null,
        leagueId: null,
      });

      expect(created.id).toBe('game-1');
    });

    it('accepts (matchId=null, leagueId=set) — Game under a League without a Match', async () => {
      const created = await service.create({
        ...baseGame,
        matchId: null,
        leagueId: 'league-1',
      });

      expect(created.leagueId).toBe('league-1');
    });

    it('accepts (matchId=set, leagueId=null) when the Match itself has leagueId=null', async () => {
      await matchRepo.create({
        id: 'match-1',
        groupId: 'g1',
        name: 'Off-meet',
        leagueId: null,
      });

      const created = await service.create({
        ...baseGame,
        matchId: 'match-1',
        leagueId: null,
      });

      expect(created.matchId).toBe('match-1');
    });

    it('accepts (matchId=set, leagueId=set) when both reference the same league', async () => {
      await matchRepo.create({
        id: 'match-1',
        groupId: 'g1',
        name: 'Round 1',
        leagueId: 'league-1',
      });

      const created = await service.create({
        ...baseGame,
        matchId: 'match-1',
        leagueId: 'league-1',
      });

      expect(created.leagueId).toBe('league-1');
    });

    it('rejects when game.leagueId disagrees with match.leagueId', async () => {
      await matchRepo.create({
        id: 'match-1',
        groupId: 'g1',
        name: 'Round 1',
        leagueId: 'league-1',
      });

      await expect(
        service.create({
          ...baseGame,
          matchId: 'match-1',
          leagueId: 'league-2',
        }),
      ).rejects.toBeInstanceOf(GameMatchLeagueMismatchError);
    });

    it('rejects when game.leagueId is null but match.leagueId is set', async () => {
      // This is the subtle case: the Match was placed inside a League at
      // creation, but the Game is being attached without inheriting it. The
      // domain rule treats null as a real value, not a wildcard.
      await matchRepo.create({
        id: 'match-1',
        groupId: 'g1',
        name: 'Round 1',
        leagueId: 'league-1',
      });

      await expect(
        service.create({
          ...baseGame,
          matchId: 'match-1',
          leagueId: null,
        }),
      ).rejects.toBeInstanceOf(GameMatchLeagueMismatchError);
    });

    it('throws EntityNotFoundError when the referenced match does not exist', async () => {
      await expect(
        service.create({
          ...baseGame,
          matchId: 'missing',
          leagueId: null,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundError);
    });
  });

  describe('update — re-runs the consistency check only when the relevant fields change', () => {
    beforeEach(async () => {
      await matchRepo.create({
        id: 'match-1',
        groupId: 'g1',
        name: 'Round 1',
        leagueId: 'league-1',
      });
      await gameRepo.create({
        ...baseGame,
        matchId: 'match-1',
        leagueId: 'league-1',
      });
    });

    it('allows updates that do not touch matchId / leagueId', async () => {
      const updated = await service.update('game-1', { rulesetId: 'r2' });
      expect(updated?.rulesetId).toBe('r2');
    });

    it('rejects updates that would break the consistency rule', async () => {
      await expect(service.update('game-1', { leagueId: 'league-2' })).rejects.toBeInstanceOf(
        GameMatchLeagueMismatchError,
      );
    });

    it('allows detaching from a match (matchId → null) regardless of leagueId', async () => {
      const updated = await service.update('game-1', { matchId: null });
      expect(updated?.matchId).toBeNull();
    });

    it('returns null when updating a missing game (after a relevant-field check is requested)', async () => {
      const result = await service.update('missing', { matchId: null });
      expect(result).toBeNull();
    });
  });
});
