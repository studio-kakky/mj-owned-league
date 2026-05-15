import { describe, expect, it } from 'vitest';
import {
  RulesetResolutionError,
  resolveRulesetId,
} from '../../../../src/domain/scoring/ruleset-resolver';

/**
 * Covers `02-domain-model.md` § Ruleset の解決順序:
 *
 *   Game.rulesetId → Match.defaultRulesetId → League.defaultRulesetId → Group.defaultRulesetId
 *
 * Falls through to the next level on `null` / `undefined`. If every level is
 * empty, we throw — the spec says Group creation should always seed a default,
 * so reaching the bottom is a data-integrity bug, not a recoverable case.
 */
describe('resolveRulesetId', () => {
  it('picks Game.rulesetId when set, ignoring the others', () => {
    const id = resolveRulesetId({
      gameRulesetId: 'game-r',
      matchDefaultRulesetId: 'match-r',
      leagueDefaultRulesetId: 'league-r',
      groupDefaultRulesetId: 'group-r',
    });
    expect(id).toBe('game-r');
  });

  it('falls through to Match.defaultRulesetId when Game has none', () => {
    const id = resolveRulesetId({
      gameRulesetId: null,
      matchDefaultRulesetId: 'match-r',
      leagueDefaultRulesetId: 'league-r',
      groupDefaultRulesetId: 'group-r',
    });
    expect(id).toBe('match-r');
  });

  it('falls through to League.defaultRulesetId when Game and Match have none', () => {
    const id = resolveRulesetId({
      gameRulesetId: null,
      matchDefaultRulesetId: null,
      leagueDefaultRulesetId: 'league-r',
      groupDefaultRulesetId: 'group-r',
    });
    expect(id).toBe('league-r');
  });

  it('falls through to Group.defaultRulesetId as the final fallback', () => {
    const id = resolveRulesetId({
      gameRulesetId: null,
      matchDefaultRulesetId: null,
      leagueDefaultRulesetId: null,
      groupDefaultRulesetId: 'group-r',
    });
    expect(id).toBe('group-r');
  });

  it('skips missing intermediate levels (Match null, League set)', () => {
    const id = resolveRulesetId({
      gameRulesetId: null,
      matchDefaultRulesetId: null, // no Match attached, or Match has no default
      leagueDefaultRulesetId: 'league-r',
      groupDefaultRulesetId: null,
    });
    expect(id).toBe('league-r');
  });

  it('treats undefined the same as null (forgiving callers who omit a layer)', () => {
    const id = resolveRulesetId({
      gameRulesetId: undefined,
      matchDefaultRulesetId: undefined,
      leagueDefaultRulesetId: 'league-r',
      groupDefaultRulesetId: 'group-r',
    });
    expect(id).toBe('league-r');
  });

  it('throws RulesetResolutionError when every level is empty', () => {
    expect(() =>
      resolveRulesetId({
        gameRulesetId: null,
        matchDefaultRulesetId: null,
        leagueDefaultRulesetId: null,
        groupDefaultRulesetId: null,
      }),
    ).toThrow(RulesetResolutionError);
  });
});
