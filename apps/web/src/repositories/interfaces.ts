/**
 * Repository contracts for the domain entities.
 *
 * Each repository is the *only* component allowed to talk to D1 directly for
 * its entity. The service layer sits on top of these interfaces and never
 * imports Drizzle. That separation gives us two concrete wins:
 *
 *  1. Services are unit-testable without spinning up SQLite / Miniflare —
 *     tests pass in an in-memory fake of the relevant interface.
 *  2. Swapping the persistence layer later (e.g. moving from D1 to a
 *     hosted Postgres for analytics) does not ripple into business rules.
 *
 * The shapes intentionally mirror Drizzle's `$inferSelect` / `$inferInsert`
 * types from `../db/schema.ts`, so a Drizzle-backed implementation can return
 * rows directly without an extra mapping step.
 */

import type {
  Game,
  GameResult,
  Group,
  Invitation,
  League,
  Match,
  NewGame,
  NewGameResult,
  NewGroup,
  NewInvitation,
  NewLeague,
  NewMatch,
  NewOwner,
  NewPlayer,
  NewRuleset,
  Owner,
  Player,
  Ruleset,
} from '../db/schema';

// `Partial<New*>` is used as the input type for `update` so callers can omit
// columns they don't want to change. We exclude `id` so it cannot be repointed
// via update (the row is identified by the separate `id` argument).
type UpdateInput<TNew> = Partial<Omit<TNew, 'id'>>;

export interface OwnerRepository {
  findById(id: string): Promise<Owner | null>;
  findByEmail(email: string): Promise<Owner | null>;
  create(input: NewOwner): Promise<Owner>;
  update(id: string, input: UpdateInput<NewOwner>): Promise<Owner | null>;
  delete(id: string): Promise<boolean>;
}

export interface GroupRepository {
  findById(id: string): Promise<Group | null>;
  listByOwner(ownerId: string): Promise<Group[]>;
  create(input: NewGroup): Promise<Group>;
  update(id: string, input: UpdateInput<NewGroup>): Promise<Group | null>;
  delete(id: string): Promise<boolean>;
}

export interface PlayerRepository {
  findById(id: string): Promise<Player | null>;
  listByGroup(groupId: string): Promise<Player[]>;
  create(input: NewPlayer): Promise<Player>;
  update(id: string, input: UpdateInput<NewPlayer>): Promise<Player | null>;
  /**
   * Returns `true` when at least one `GameResult` references this player.
   * The service layer uses this to decide whether physical deletion is legal
   * (`02-domain-model.md` § Player).
   */
  hasGameHistory(id: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

export interface RulesetRepository {
  findById(id: string): Promise<Ruleset | null>;
  listByGroup(groupId: string): Promise<Ruleset[]>;
  create(input: NewRuleset): Promise<Ruleset>;
  update(id: string, input: UpdateInput<NewRuleset>): Promise<Ruleset | null>;
  delete(id: string): Promise<boolean>;
}

export interface LeagueRepository {
  findById(id: string): Promise<League | null>;
  findByPublicSlug(publicSlug: string): Promise<League | null>;
  listByGroup(groupId: string): Promise<League[]>;
  create(input: NewLeague): Promise<League>;
  update(id: string, input: UpdateInput<NewLeague>): Promise<League | null>;
  delete(id: string): Promise<boolean>;
}

export interface MatchRepository {
  findById(id: string): Promise<Match | null>;
  listByGroup(groupId: string): Promise<Match[]>;
  listByLeague(leagueId: string): Promise<Match[]>;
  create(input: NewMatch): Promise<Match>;
  update(id: string, input: UpdateInput<NewMatch>): Promise<Match | null>;
  delete(id: string): Promise<boolean>;
}

export interface GameRepository {
  findById(id: string): Promise<Game | null>;
  listByGroup(groupId: string): Promise<Game[]>;
  listByMatch(matchId: string): Promise<Game[]>;
  listByLeague(leagueId: string): Promise<Game[]>;
  create(input: NewGame): Promise<Game>;
  update(id: string, input: UpdateInput<NewGame>): Promise<Game | null>;
  delete(id: string): Promise<boolean>;
}

export interface InvitationRepository {
  findById(id: string): Promise<Invitation | null>;
  /**
   * Token-based lookup is the hot path: the `/invitations/accept/:token`
   * route resolves the token from the URL before letting the user proceed
   * with Google OAuth.
   */
  findByToken(token: string): Promise<Invitation | null>;
  listByIssuer(ownerId: string): Promise<Invitation[]>;
  create(input: NewInvitation): Promise<Invitation>;
  update(id: string, input: UpdateInput<NewInvitation>): Promise<Invitation | null>;
}

export interface GameResultRepository {
  listByGame(gameId: string): Promise<GameResult[]>;
  /**
   * Bulk-inserts the 3 or 4 results for a Game in one call. Single-row insert
   * is intentionally absent: the domain doc states every Game has exactly
   * `format`-many results, so partial inserts would only ever indicate a bug.
   */
  createMany(inputs: NewGameResult[]): Promise<GameResult[]>;
  /**
   * Replaces *all* results for a Game in one transaction (delete-then-insert).
   * Used when correcting score input mistakes after the fact.
   */
  replaceForGame(gameId: string, inputs: NewGameResult[]): Promise<GameResult[]>;
  deleteByGame(gameId: string): Promise<number>;
}
