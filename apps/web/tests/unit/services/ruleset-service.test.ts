import { beforeEach, describe, expect, it } from 'vitest';
import { RulesetService, TobiConfigurationError } from '../../../src/services/ruleset-service';
import { FakeRulesetRepository } from './fakes';

/**
 * `02-domain-model.md` § Ruleset says `tobiPoint` is required iff
 * `tobiEnabled = true`. This file proves the service rejects both ways of
 * breaking that invariant — including on partial updates.
 */
describe('RulesetService — tobi configuration invariant', () => {
  let repo: FakeRulesetRepository;
  let service: RulesetService;

  const base = {
    id: 'r1',
    groupId: 'g1',
    name: 'Standard',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30' as const,
  };

  beforeEach(() => {
    repo = new FakeRulesetRepository();
    service = new RulesetService(repo);
  });

  describe('create', () => {
    it('accepts tobiEnabled=true with a tobiPoint', async () => {
      const created = await service.create({ ...base, tobiEnabled: true, tobiPoint: 10 });
      expect(created.tobiPoint).toBe(10);
    });

    it('accepts tobiEnabled=false without a tobiPoint', async () => {
      const created = await service.create({ ...base, tobiEnabled: false, tobiPoint: null });
      expect(created.tobiPoint).toBeNull();
    });

    it('rejects tobiEnabled=true with tobiPoint=null', async () => {
      await expect(
        service.create({ ...base, tobiEnabled: true, tobiPoint: null }),
      ).rejects.toBeInstanceOf(TobiConfigurationError);
    });

    it('rejects tobiEnabled=false with a tobiPoint set', async () => {
      await expect(
        service.create({ ...base, tobiEnabled: false, tobiPoint: 10 }),
      ).rejects.toBeInstanceOf(TobiConfigurationError);
    });
  });

  describe('update — evaluates the rule against the merged post-update state', () => {
    it('rejects flipping tobiEnabled to true without supplying a tobiPoint', async () => {
      await service.create({ ...base, tobiEnabled: false, tobiPoint: null });

      await expect(service.update('r1', { tobiEnabled: true })).rejects.toBeInstanceOf(
        TobiConfigurationError,
      );
    });

    it('accepts flipping tobiEnabled to true together with a tobiPoint', async () => {
      await service.create({ ...base, tobiEnabled: false, tobiPoint: null });

      const updated = await service.update('r1', { tobiEnabled: true, tobiPoint: 10 });
      expect(updated?.tobiEnabled).toBe(true);
      expect(updated?.tobiPoint).toBe(10);
    });

    it('accepts disabling tobi when clearing tobiPoint at the same time', async () => {
      await service.create({ ...base, tobiEnabled: true, tobiPoint: 10 });

      const updated = await service.update('r1', { tobiEnabled: false, tobiPoint: null });
      expect(updated?.tobiEnabled).toBe(false);
      expect(updated?.tobiPoint).toBeNull();
    });

    it('returns null when updating a missing ruleset', async () => {
      const result = await service.update('missing', { name: 'new' });
      expect(result).toBeNull();
    });
  });
});
