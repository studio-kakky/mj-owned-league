import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerHasHistoryError } from '../../../src/services/errors';
import { PlayerService } from '../../../src/services/player-service';
import { FakePlayerRepository } from './fakes';

/**
 * Covers the Player deletion rule from `02-domain-model.md` § Player:
 * physical delete is only legal when no `GameResult` references the Player.
 * History-bearing Players must go through `deactivate` instead.
 */
describe('PlayerService', () => {
  let repo: FakePlayerRepository;
  let service: PlayerService;

  beforeEach(() => {
    repo = new FakePlayerRepository();
    service = new PlayerService(repo);
  });

  describe('delete', () => {
    it('physically deletes a player with no game history', async () => {
      await repo.create({ id: 'p1', groupId: 'g1', name: 'Alice' });

      const deleted = await service.delete('p1');

      expect(deleted).toBe(true);
      expect(await repo.findById('p1')).toBeNull();
    });

    it('throws PlayerHasHistoryError when the player has at least one game result', async () => {
      await repo.create({ id: 'p1', groupId: 'g1', name: 'Alice' });
      repo.history.add('p1');

      await expect(service.delete('p1')).rejects.toBeInstanceOf(PlayerHasHistoryError);
      // Row must remain — the failure should be all-or-nothing.
      expect(await repo.findById('p1')).not.toBeNull();
    });

    it('returns false when the target player does not exist', async () => {
      const deleted = await service.delete('missing');
      expect(deleted).toBe(false);
    });
  });

  describe('deactivate / reactivate', () => {
    it('sets isActive=false on deactivate', async () => {
      await repo.create({ id: 'p1', groupId: 'g1', name: 'Alice' });

      const updated = await service.deactivate('p1');

      expect(updated?.isActive).toBe(false);
    });

    it('sets isActive=true on reactivate', async () => {
      await repo.create({ id: 'p1', groupId: 'g1', name: 'Alice', isActive: false });

      const updated = await service.reactivate('p1');

      expect(updated?.isActive).toBe(true);
    });
  });
});
