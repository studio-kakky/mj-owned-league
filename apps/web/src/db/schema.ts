/**
 * Drizzle schema for the JANROKU D1 database.
 *
 * The entities, relationships, and integrity constraints modelled here come
 * directly from `docs/docs/02-domain-model.md`. Where the domain doc speaks
 * of `decimal`, we store `real` (REAL / double) per `docs/docs/05-tech-stack.md`,
 * because SQLite (and therefore D1) has no `decimal` type. Display-time
 * rounding lives in the UI / domain layer, not in the schema.
 *
 * Conventions used in this file:
 * - IDs are TEXT (UUID strings) — chosen over INTEGER autoincrement because
 *   the domain doc spells out UUID and because public-facing URLs may want
 *   non-sequential identifiers.
 * - Timestamps are stored as TEXT (`CURRENT_TIMESTAMP` default), matching the
 *   existing `ping_checks` smoke-test table and SQLite's idiomatic style.
 * - Enum-like columns are stored as TEXT with a Drizzle `enum: [...]` constraint
 *   so the TypeScript type narrows to the literal union without needing a
 *   separate enum / lookup table.
 * - Foreign keys are declared inline with `.references(() => other.id)` and
 *   carry an explicit `onDelete` policy. We err toward `restrict` (the SQLite
 *   default for `references` without action) for parent rows whose history we
 *   must preserve (Player, Group, etc.), and `set null` for the optional
 *   League / Match links on `Match` / `Game`, so deleting a League / Match
 *   does not cascade-destroy the underlying Game rows.
 */

import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Enum value sets
// ---------------------------------------------------------------------------
// Exporting these as `as const` arrays serves two purposes:
//   1. Drizzle's `text({ enum: [...] })` needs a literal tuple to narrow the
//      column type.
//   2. Tests / services can reuse the same source of truth (e.g. when iterating
//      over every uma pattern to assert it parses cleanly).
//
// The values mirror `02-domain-model.md` § Ruleset and § GameResult exactly.

export const LEAGUE_FORMATS = ['4P_HANCHAN', '4P_TONPU', '3P_HANCHAN', '3P_TONPU'] as const;
export type LeagueFormat = (typeof LEAGUE_FORMATS)[number];

export const UMA_PATTERNS = [
  // 4-player patterns
  'UMA_10_30',
  'UMA_10_20',
  'UMA_5_10',
  // 3-player patterns
  'UMA_3P_40',
  'UMA_3P_30',
  'UMA_3P_20',
  'UMA_3P_15',
] as const;
export type UmaPattern = (typeof UMA_PATTERNS)[number];

export const TOBI_ROLES = ['INFLICTOR', 'VICTIM'] as const;
export type TobiRole = (typeof TOBI_ROLES)[number];

// ---------------------------------------------------------------------------
// Smoke-test table (kept from #6 toolchain bring-up)
// ---------------------------------------------------------------------------
// `ping_checks` is the round-trip smoke-test table introduced in #6. It is
// intentionally kept here so the existing worker route (`/api/db/drizzle-ping`)
// and unit test for `drizzle-zod` keep working. It does not participate in any
// domain relationship.

export const pingChecks = sqliteTable('ping_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type PingCheck = typeof pingChecks.$inferSelect;
export type NewPingCheck = typeof pingChecks.$inferInsert;

// ---------------------------------------------------------------------------
// Owner — the only writeable role (`02-domain-model.md` § Owner)
// ---------------------------------------------------------------------------

export const owners = sqliteTable('owners', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type Owner = typeof owners.$inferSelect;
export type NewOwner = typeof owners.$inferInsert;

// ---------------------------------------------------------------------------
// Group — top-level container under an Owner (`02-domain-model.md` § Group)
// ---------------------------------------------------------------------------
// `defaultRulesetId` is forward-declared with `AnySQLiteColumn` because
// `groups` and `rulesets` reference each other (Group → default Ruleset,
// Ruleset → Group). Drizzle requires breaking that cycle for one side.

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => owners.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Forward reference: declared without typed `.references()` so it survives
  // the schema cycle. Integrity is enforced at the service layer.
  defaultRulesetId: text('default_ruleset_id').references((): AnySQLiteColumn => rulesets.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

// ---------------------------------------------------------------------------
// Player — non-account participant under a Group (`02-domain-model.md` § Player)
// ---------------------------------------------------------------------------
// Deletion policy (Players that appear in any GameResult cannot be physically
// deleted) is enforced in the service layer — SQLite cannot express that as
// a column constraint.

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // `mode: 'boolean'` instructs Drizzle to map between JS booleans and the
  // underlying INTEGER (0/1) without requiring callers to think about it.
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;

// ---------------------------------------------------------------------------
// Ruleset — uma / oka / tobi config under a Group (`02-domain-model.md` § Ruleset)
// ---------------------------------------------------------------------------

export const rulesets = sqliteTable('rulesets', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startingScore: integer('starting_score').notNull(),
  returnScore: integer('return_score').notNull(),
  umaPattern: text('uma_pattern', { enum: UMA_PATTERNS }).notNull(),
  tobiEnabled: integer('tobi_enabled', { mode: 'boolean' }).notNull().default(false),
  // `tobiPoint` is required when `tobiEnabled = true` and ignored otherwise.
  // That conditional requirement is checked in the service / Zod layer rather
  // than as a SQL CHECK constraint, because expressing it in SQL would not
  // round-trip cleanly through drizzle-kit's snapshot diff.
  tobiPoint: real('tobi_point'),
});

export type Ruleset = typeof rulesets.$inferSelect;
export type NewRuleset = typeof rulesets.$inferInsert;

// ---------------------------------------------------------------------------
// League — period-scoped aggregation unit (`02-domain-model.md` § League)
// ---------------------------------------------------------------------------

export const leagues = sqliteTable('leagues', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // `format` is fixed at creation time (domain rule), but we don't try to
  // enforce immutability at the DB level — that's a service-layer rule.
  format: text('format', { enum: LEAGUE_FORMATS }).notNull(),
  defaultRulesetId: text('default_ruleset_id').references(() => rulesets.id, {
    onDelete: 'set null',
  }),
  publicSlug: text('public_slug').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;

// ---------------------------------------------------------------------------
// Match — bundles multiple Games (`02-domain-model.md` § Match)
// ---------------------------------------------------------------------------

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  // Optional League link — deleting the League nulls this out rather than
  // destroying the Match (Matches may have historical value standalone).
  leagueId: text('league_id').references(() => leagues.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  sequenceNumber: integer('sequence_number'),
  // `heldAt` is a *date* per the domain doc, not a timestamp — stored as TEXT
  // in ISO `YYYY-MM-DD` form. SQLite has no native date type.
  heldAt: text('held_at'),
  memo: text('memo'),
  defaultRulesetId: text('default_ruleset_id').references(() => rulesets.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

// ---------------------------------------------------------------------------
// Game — a single hanchan / tonpu (`02-domain-model.md` § Game)
// ---------------------------------------------------------------------------
// Integrity rule "if both matchId and leagueId are present, they must agree
// (game.leagueId === match.leagueId)" is enforced in the service layer; SQLite
// CHECK constraints cannot reach across tables.

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  matchId: text('match_id').references(() => matches.id, { onDelete: 'set null' }),
  leagueId: text('league_id').references(() => leagues.id, { onDelete: 'set null' }),
  format: text('format', { enum: LEAGUE_FORMATS }).notNull(),
  // `rulesetId` is the resolved Ruleset captured at Game creation time. Even
  // if the Ruleset is later edited or deleted, this Game's points stay tied
  // to whatever rules were applied — hence `restrict` to block deletion.
  rulesetId: text('ruleset_id')
    .notNull()
    .references(() => rulesets.id, { onDelete: 'restrict' }),
  playedAt: text('played_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

// ---------------------------------------------------------------------------
// GameResult — per-player outcome for a Game (`02-domain-model.md` § GameResult)
// ---------------------------------------------------------------------------
// Composite primary key `(gameId, playerId)`: each player can appear in a
// given Game at most once. The sum-of-rawScore integrity check
// (`02-domain-model.md` § GameResult) lives in the service layer, since SQLite
// CHECK cannot aggregate sibling rows.

export const gameResults = sqliteTable(
  'game_results',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    rawScore: integer('raw_score').notNull(),
    // `points` is stored as REAL (see file-level comment on decimal → real).
    points: real('points').notNull(),
    rank: integer('rank').notNull(),
    tobiRole: text('tobi_role', { enum: TOBI_ROLES }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.gameId, table.playerId] }),
  }),
);

export type GameResult = typeof gameResults.$inferSelect;
export type NewGameResult = typeof gameResults.$inferInsert;
