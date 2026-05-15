/**
 * Oka total calculation.
 *
 * From `docs/docs/02-domain-model.md` § オカ:
 *
 *     oka = (returnScore − startingScore) × players / 1000
 *
 * The full amount goes to the rank-1 player(s). If there's a tie for rank 1,
 * the caller is responsible for splitting it (we currently follow the same
 * "均等割り" rule the spec gives for uma, since the spec is silent on oka
 * splits — see `ranking.ts`).
 *
 * Pure function module.
 */

export interface OkaInput {
  /** Ruleset.startingScore — points each player starts a hanchan with. */
  startingScore: number;
  /** Ruleset.returnScore — points exchanged for ±0 at the end. */
  returnScore: number;
  /** Player count for this game (3 or 4 in MVP, but the formula is general). */
  players: number;
}

/**
 * Returns the total oka pot in *display* units (the spec divides by 1000, so a
 * 25000 → 30000 / 4-player setup yields +20.0, not +20000). The caller adds
 * this to the rank-1 player's points line.
 */
export const okaTotal = (input: OkaInput): number => {
  if (input.players <= 0) {
    throw new RangeError(`players must be > 0, got ${input.players}`);
  }
  if (input.returnScore < input.startingScore) {
    throw new RangeError(
      `returnScore (${input.returnScore}) must be ≥ startingScore (${input.startingScore})`,
    );
  }
  return ((input.returnScore - input.startingScore) * input.players) / 1000;
};
