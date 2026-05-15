import { beforeEach, describe, expect, it } from 'vitest';
import { GameMatchLeagueMismatchError } from '../../../src/services/errors';
import { MatchService } from '../../../src/services/match-service';
import { FakeGameRepository, FakeMatchRepository } from './fakes';

/**
 * MatchService re-validates the same matchId/leagueId rule from
 * `02-domain-model.md` § Game when a Match is re-pointed at a different
 * League — because that operation transitively re-points every attached Game.
 */
describe('MatchService — leagueId change validates attached games', () => {
  let matchRepo: FakeMatchRepository;
  let gameRepo: FakeGameRepository;
  let service: MatchService;

  beforeEach(() => {
    matchRepo = new FakeMatchRepository();
    gameRepo = new FakeGameRepository();
    service = new MatchService(matchRepo, gameRepo);
  });

  it('allows changing leagueId when the match has no games attached', async () => {
    await matchRepo.create({ id: 'm1', groupId: 'g1', name: 'M', leagueId: null });

    const updated = await service.update('m1', { leagueId: 'league-1' });

    expect(updated?.leagueId).toBe('league-1');
  });

  it('rejects when an attached game would end up with a different leagueId', async () => {
    await matchRepo.create({ id: 'm1', groupId: 'g1', name: 'M', leagueId: 'league-1' });
    await gameRepo.create({
      id: 'game-1',
      groupId: 'g1',
      matchId: 'm1',
      leagueId: 'league-1',
      format: '4P_HANCHAN',
      rulesetId: 'r1',
      playedAt: '2026-05-15T00:00:00.000Z',
    });

    await expect(service.update('m1', { leagueId: 'league-2' })).rejects.toBeInstanceOf(
      GameMatchLeagueMismatchError,
    );
  });

  it('allows updates that do not touch leagueId', async () => {
    await matchRepo.create({ id: 'm1', groupId: 'g1', name: 'M', leagueId: 'league-1' });

    const updated = await service.update('m1', { name: 'renamed' });

    expect(updated?.name).toBe('renamed');
  });

  it('returns null when updating a missing match', async () => {
    const result = await service.update('missing', { leagueId: 'league-1' });
    expect(result).toBeNull();
  });
});
