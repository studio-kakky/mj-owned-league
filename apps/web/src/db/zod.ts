/**
 * Zod schemas derived from the Drizzle schema via `drizzle-zod`.
 *
 * For every domain entity we expose three schemas:
 *   - `select*Schema` — shape of a row read from D1 (every column populated).
 *   - `insert*Schema` — shape accepted by `INSERT` (server-defaulted columns
 *     optional, e.g. `createdAt`).
 *   - `update*Schema` — shape accepted by `UPDATE` (every column optional).
 *
 * Generating these from the Drizzle table definitions removes the risk of
 * client / server / DB drifting in opposite directions: when a new column is
 * added to `schema.ts`, the Zod schemas pick it up automatically.
 *
 * Why split this out from `schema.ts`?
 *   - `schema.ts` is imported by the Workers runtime (`worker/index.ts`); we
 *     don't want to drag `drizzle-zod` and `zod` into the Worker bundle just
 *     for table definitions.
 *   - Request validation is a separate concern from table definition itself.
 *
 * Cross-record / cross-table invariants (e.g. "if `tobiEnabled` is true then
 * `tobiPoint` must be set", "raw scores must sum to startingScore × players")
 * are NOT enforced here — they live in the service layer. `refine` could
 * cover the single-record case (`tobiPoint` required when `tobiEnabled`), but
 * keeping all integrity rules in one place (services) is easier to reason
 * about than splitting them between Zod and code.
 */

import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import {
  gameResults,
  games,
  groups,
  leagues,
  matches,
  owners,
  pingChecks,
  players,
  rulesets,
} from './schema';

// --- ping_checks (smoke test from #6) --------------------------------------

export const selectPingCheckSchema = createSelectSchema(pingChecks);
export const insertPingCheckSchema = createInsertSchema(pingChecks);
export const updatePingCheckSchema = createUpdateSchema(pingChecks);

// --- owners ----------------------------------------------------------------

export const selectOwnerSchema = createSelectSchema(owners);
export const insertOwnerSchema = createInsertSchema(owners);
export const updateOwnerSchema = createUpdateSchema(owners);

// --- groups ----------------------------------------------------------------

export const selectGroupSchema = createSelectSchema(groups);
export const insertGroupSchema = createInsertSchema(groups);
export const updateGroupSchema = createUpdateSchema(groups);

// --- players ---------------------------------------------------------------

export const selectPlayerSchema = createSelectSchema(players);
export const insertPlayerSchema = createInsertSchema(players);
export const updatePlayerSchema = createUpdateSchema(players);

// --- rulesets --------------------------------------------------------------

export const selectRulesetSchema = createSelectSchema(rulesets);
export const insertRulesetSchema = createInsertSchema(rulesets);
export const updateRulesetSchema = createUpdateSchema(rulesets);

// --- leagues ---------------------------------------------------------------

export const selectLeagueSchema = createSelectSchema(leagues);
export const insertLeagueSchema = createInsertSchema(leagues);
export const updateLeagueSchema = createUpdateSchema(leagues);

// --- matches ---------------------------------------------------------------

export const selectMatchSchema = createSelectSchema(matches);
export const insertMatchSchema = createInsertSchema(matches);
export const updateMatchSchema = createUpdateSchema(matches);

// --- games -----------------------------------------------------------------

export const selectGameSchema = createSelectSchema(games);
export const insertGameSchema = createInsertSchema(games);
export const updateGameSchema = createUpdateSchema(games);

// --- game_results ----------------------------------------------------------

export const selectGameResultSchema = createSelectSchema(gameResults);
export const insertGameResultSchema = createInsertSchema(gameResults);
export const updateGameResultSchema = createUpdateSchema(gameResults);
