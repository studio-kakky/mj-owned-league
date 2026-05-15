import { describe, expect, it } from 'vitest';
import { okaTotal } from '../../../../src/domain/scoring/oka';

/**
 * Pins down `oka = (returnScore − startingScore) × players / 1000`
 * from `02-domain-model.md` § オカ. Top-takes-all is fixed by spec; the
 * function only returns the *total* — distribution is the caller's job
 * (always to rank 1, possibly split across tied rank-1 group).
 */
describe('okaTotal', () => {
  it('returns 20 for 25000-start / 30000-return / 4 players (canonical example)', () => {
    expect(okaTotal({ startingScore: 25000, returnScore: 30000, players: 4 })).toBe(20);
  });

  it('returns 15 for 25000-start / 30000-return / 3 players', () => {
    expect(okaTotal({ startingScore: 25000, returnScore: 30000, players: 3 })).toBe(15);
  });

  it('returns 0 when startingScore === returnScore (no oka in this ruleset)', () => {
    expect(okaTotal({ startingScore: 30000, returnScore: 30000, players: 4 })).toBe(0);
  });

  it('throws for non-positive player counts', () => {
    expect(() => okaTotal({ startingScore: 25000, returnScore: 30000, players: 0 })).toThrow();
    expect(() => okaTotal({ startingScore: 25000, returnScore: 30000, players: -1 })).toThrow();
  });

  it('throws when returnScore is lower than startingScore (would imply negative oka)', () => {
    expect(() => okaTotal({ startingScore: 30000, returnScore: 25000, players: 4 })).toThrow();
  });
});
