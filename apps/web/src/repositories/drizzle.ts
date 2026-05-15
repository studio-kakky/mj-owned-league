/**
 * Drizzle-backed implementations of every repository interface.
 *
 * Each implementation is a thin wrapper around `Database` (the typed Drizzle
 * client from `../db/client.ts`). The implementations carry no business rules
 * — those live in `../services/*` — so they remain a near 1:1 mapping from
 * the interface methods to Drizzle's query builder.
 *
 * Performance note: every method is `async` even when the underlying call
 * could in principle be synchronous, because Drizzle's D1 driver returns
 * Promises and we don't want to change the contract once a faster driver
 * arrives. The cost of the extra microtask is negligible at the request rates
 * MVP targets.
 */

import { and, count, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  type Game,
  type GameResult,
  type Group,
  gameResults,
  games,
  groups,
  type Invitation,
  invitations,
  type League,
  leagues,
  type Match,
  matches,
  type NewGame,
  type NewGameResult,
  type NewGroup,
  type NewInvitation,
  type NewLeague,
  type NewMatch,
  type NewOwner,
  type NewPlayer,
  type NewRuleset,
  type Owner,
  owners,
  type Player,
  players,
  type Ruleset,
  rulesets,
} from '../db/schema';
import type {
  GameRepository,
  GameResultRepository,
  GroupRepository,
  InvitationRepository,
  LeagueRepository,
  MatchRepository,
  OwnerRepository,
  PlayerRepository,
  RulesetRepository,
} from './interfaces';

// `Partial<Omit<T, 'id'>>` matches the update input shape used by the
// repository interfaces. Defined locally to avoid re-exporting it.
type UpdateInput<T> = Partial<Omit<T, 'id'>>;

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------

export class DrizzleOwnerRepository implements OwnerRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Owner | null> {
    const rows = await this.db.select().from(owners).where(eq(owners.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<Owner | null> {
    const rows = await this.db.select().from(owners).where(eq(owners.email, email)).limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewOwner): Promise<Owner> {
    const [row] = await this.db.insert(owners).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewOwner>): Promise<Owner | null> {
    const [row] = await this.db.update(owners).set(input).where(eq(owners.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(owners).where(eq(owners.id, id)).returning();
    return deleted.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export class DrizzleGroupRepository implements GroupRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Group | null> {
    const rows = await this.db.select().from(groups).where(eq(groups.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listByOwner(ownerId: string): Promise<Group[]> {
    return this.db.select().from(groups).where(eq(groups.ownerId, ownerId));
  }

  async create(input: NewGroup): Promise<Group> {
    const [row] = await this.db.insert(groups).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewGroup>): Promise<Group | null> {
    const [row] = await this.db.update(groups).set(input).where(eq(groups.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(groups).where(eq(groups.id, id)).returning();
    return deleted.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export class DrizzlePlayerRepository implements PlayerRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Player | null> {
    const rows = await this.db.select().from(players).where(eq(players.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listByGroup(groupId: string): Promise<Player[]> {
    return this.db.select().from(players).where(eq(players.groupId, groupId));
  }

  async create(input: NewPlayer): Promise<Player> {
    const [row] = await this.db.insert(players).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewPlayer>): Promise<Player | null> {
    const [row] = await this.db.update(players).set(input).where(eq(players.id, id)).returning();
    return row ?? null;
  }

  async hasGameHistory(id: string): Promise<boolean> {
    // We only need a yes/no answer, so `count(*)` with an early `limit` would
    // be ideal — but Drizzle's `count()` already short-circuits on the SQLite
    // planner for a simple equality predicate, and the table has a covering
    // index on the FK. Sticking with `count` keeps the call expressive.
    const [row] = await this.db
      .select({ value: count() })
      .from(gameResults)
      .where(eq(gameResults.playerId, id));
    return (row?.value ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(players).where(eq(players.id, id)).returning();
    return deleted.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Ruleset
// ---------------------------------------------------------------------------

export class DrizzleRulesetRepository implements RulesetRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Ruleset | null> {
    const rows = await this.db.select().from(rulesets).where(eq(rulesets.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listByGroup(groupId: string): Promise<Ruleset[]> {
    return this.db.select().from(rulesets).where(eq(rulesets.groupId, groupId));
  }

  async create(input: NewRuleset): Promise<Ruleset> {
    const [row] = await this.db.insert(rulesets).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewRuleset>): Promise<Ruleset | null> {
    const [row] = await this.db.update(rulesets).set(input).where(eq(rulesets.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(rulesets).where(eq(rulesets.id, id)).returning();
    return deleted.length > 0;
  }
}

// ---------------------------------------------------------------------------
// League
// ---------------------------------------------------------------------------

export class DrizzleLeagueRepository implements LeagueRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<League | null> {
    const rows = await this.db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByPublicSlug(publicSlug: string): Promise<League | null> {
    const rows = await this.db
      .select()
      .from(leagues)
      .where(eq(leagues.publicSlug, publicSlug))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByGroup(groupId: string): Promise<League[]> {
    return this.db.select().from(leagues).where(eq(leagues.groupId, groupId));
  }

  async create(input: NewLeague): Promise<League> {
    const [row] = await this.db.insert(leagues).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewLeague>): Promise<League | null> {
    const [row] = await this.db.update(leagues).set(input).where(eq(leagues.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(leagues).where(eq(leagues.id, id)).returning();
    return deleted.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

export class DrizzleMatchRepository implements MatchRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Match | null> {
    const rows = await this.db.select().from(matches).where(eq(matches.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listByGroup(groupId: string): Promise<Match[]> {
    return this.db.select().from(matches).where(eq(matches.groupId, groupId));
  }

  async listByLeague(leagueId: string): Promise<Match[]> {
    return this.db.select().from(matches).where(eq(matches.leagueId, leagueId));
  }

  async create(input: NewMatch): Promise<Match> {
    const [row] = await this.db.insert(matches).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewMatch>): Promise<Match | null> {
    const [row] = await this.db.update(matches).set(input).where(eq(matches.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(matches).where(eq(matches.id, id)).returning();
    return deleted.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export class DrizzleGameRepository implements GameRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Game | null> {
    const rows = await this.db.select().from(games).where(eq(games.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listByGroup(groupId: string): Promise<Game[]> {
    return this.db.select().from(games).where(eq(games.groupId, groupId));
  }

  async listByMatch(matchId: string): Promise<Game[]> {
    return this.db.select().from(games).where(eq(games.matchId, matchId));
  }

  async listByLeague(leagueId: string): Promise<Game[]> {
    return this.db.select().from(games).where(eq(games.leagueId, leagueId));
  }

  async create(input: NewGame): Promise<Game> {
    const [row] = await this.db.insert(games).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewGame>): Promise<Game | null> {
    const [row] = await this.db.update(games).set(input).where(eq(games.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(games).where(eq(games.id, id)).returning();
    return deleted.length > 0;
  }
}

// ---------------------------------------------------------------------------
// GameResult
// ---------------------------------------------------------------------------

export class DrizzleGameResultRepository implements GameResultRepository {
  constructor(private readonly db: Database) {}

  async listByGame(gameId: string): Promise<GameResult[]> {
    return this.db.select().from(gameResults).where(eq(gameResults.gameId, gameId));
  }

  async createMany(inputs: NewGameResult[]): Promise<GameResult[]> {
    if (inputs.length === 0) return [];
    return this.db.insert(gameResults).values(inputs).returning();
  }

  async replaceForGame(gameId: string, inputs: NewGameResult[]): Promise<GameResult[]> {
    // D1 supports transactions via `db.batch(...)`. We use it here so that a
    // failed insert leaves the previous results in place rather than leaving
    // the Game with zero rows. Each statement is built outside the batch call
    // so the types are visible to the caller without `any`.
    const deleteStmt = this.db.delete(gameResults).where(eq(gameResults.gameId, gameId));

    if (inputs.length === 0) {
      await this.db.batch([deleteStmt]);
      return [];
    }

    const insertStmt = this.db.insert(gameResults).values(inputs).returning();
    // `db.batch` returns one result per statement, in order. The first slot
    // is the delete (we ignore its `[]` return), the second is the insert.
    const [, inserted] = await this.db.batch([deleteStmt, insertStmt]);
    return inserted;
  }

  async deleteByGame(gameId: string): Promise<number> {
    const deleted = await this.db
      .delete(gameResults)
      .where(and(eq(gameResults.gameId, gameId)))
      .returning();
    return deleted.length;
  }
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------
// Like the other repositories, this class is a thin pass-through. The
// invitation lifecycle (PENDING → CONSUMED / REVOKED, expiry handling) lives
// in `InvitationService` so it can be unit-tested against the fake repository
// without touching D1.

export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Invitation | null> {
    const rows = await this.db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByToken(token: string): Promise<Invitation | null> {
    const rows = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByIssuer(ownerId: string): Promise<Invitation[]> {
    return this.db.select().from(invitations).where(eq(invitations.issuedByOwnerId, ownerId));
  }

  async create(input: NewInvitation): Promise<Invitation> {
    const [row] = await this.db.insert(invitations).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateInput<NewInvitation>): Promise<Invitation | null> {
    const [row] = await this.db
      .update(invitations)
      .set(input)
      .where(eq(invitations.id, id))
      .returning();
    return row ?? null;
  }
}
