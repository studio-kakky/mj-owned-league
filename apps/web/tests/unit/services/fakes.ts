/**
 * In-memory fakes of the repository interfaces from
 * `../../../src/repositories/interfaces.ts`.
 *
 * These exist purely for service-level tests: we want to assert business
 * rules (Player deletion-with-history, Game matchId/leagueId integrity, etc.)
 * without spinning up D1 or even better-sqlite3. The fakes hold their state
 * in Maps so each test can seed and assert without isolation concerns —
 * construct a fresh fake per `it`.
 *
 * What the fakes do NOT do:
 *   - Enforce schema-level constraints (NOT NULL, FK, UNIQUE). The service
 *     layer doesn't rely on those for its rules; Drizzle / D1 enforce them
 *     at runtime in production, and a Drizzle-backed integration test would
 *     be the right place to cover schema bugs.
 *   - Implement listing predicates beyond what tests need. Add methods if a
 *     new test wants them; don't pre-build "complete" fakes.
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
} from '../../../src/db/schema';
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
} from '../../../src/repositories/interfaces';

const now = (): string => '2026-05-15T00:00:00.000Z';

type UpdateInput<T> = Partial<Omit<T, 'id'>>;

const applyUpdate = <TRow extends { id: string }>(
  existing: TRow,
  patch: Record<string, unknown>,
): TRow => {
  // Spread keeps `id` because we omit it from `patch`. We type `patch` as a
  // plain record because the update-input type (derived from `New*`) has
  // looser optionality than the row type (`Select*`), but the columns agree
  // at runtime — the looseness is purely a Drizzle-level type artifact for
  // server-defaulted columns.
  return { ...existing, ...(patch as Partial<TRow>) };
};

export class FakeOwnerRepository implements OwnerRepository {
  readonly rows = new Map<string, Owner>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByEmail(email: string) {
    for (const row of this.rows.values()) {
      if (row.email === email) return row;
    }
    return null;
  }
  async create(input: NewOwner) {
    const row: Owner = { createdAt: now(), ...input } as Owner;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewOwner>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

export class FakeGroupRepository implements GroupRepository {
  readonly rows = new Map<string, Group>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listByOwner(ownerId: string) {
    return [...this.rows.values()].filter((g) => g.ownerId === ownerId);
  }
  async create(input: NewGroup) {
    const row: Group = {
      createdAt: now(),
      defaultRulesetId: null,
      ...input,
    } as Group;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewGroup>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

export class FakePlayerRepository implements PlayerRepository {
  readonly rows = new Map<string, Player>();
  /** Test hook: set this to mark a player as having history. */
  readonly history = new Set<string>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listByGroup(groupId: string) {
    return [...this.rows.values()].filter((p) => p.groupId === groupId);
  }
  async create(input: NewPlayer) {
    const row: Player = {
      createdAt: now(),
      isActive: true,
      ...input,
    } as Player;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewPlayer>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
  async hasGameHistory(id: string) {
    return this.history.has(id);
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

export class FakeRulesetRepository implements RulesetRepository {
  readonly rows = new Map<string, Ruleset>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listByGroup(groupId: string) {
    return [...this.rows.values()].filter((r) => r.groupId === groupId);
  }
  async create(input: NewRuleset) {
    const row: Ruleset = {
      tobiEnabled: false,
      tobiPoint: null,
      ...input,
    } as Ruleset;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewRuleset>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

export class FakeLeagueRepository implements LeagueRepository {
  readonly rows = new Map<string, League>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByPublicSlug(publicSlug: string) {
    for (const row of this.rows.values()) {
      if (row.publicSlug === publicSlug) return row;
    }
    return null;
  }
  async listByGroup(groupId: string) {
    return [...this.rows.values()].filter((l) => l.groupId === groupId);
  }
  async create(input: NewLeague) {
    const row: League = {
      createdAt: now(),
      defaultRulesetId: null,
      ...input,
    } as League;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewLeague>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

export class FakeMatchRepository implements MatchRepository {
  readonly rows = new Map<string, Match>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listByGroup(groupId: string) {
    return [...this.rows.values()].filter((m) => m.groupId === groupId);
  }
  async listByLeague(leagueId: string) {
    return [...this.rows.values()].filter((m) => m.leagueId === leagueId);
  }
  async create(input: NewMatch) {
    const row: Match = {
      createdAt: now(),
      leagueId: null,
      sequenceNumber: null,
      heldAt: null,
      memo: null,
      defaultRulesetId: null,
      ...input,
    } as Match;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewMatch>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

export class FakeGameRepository implements GameRepository {
  readonly rows = new Map<string, Game>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listByGroup(groupId: string) {
    return [...this.rows.values()].filter((g) => g.groupId === groupId);
  }
  async listByMatch(matchId: string) {
    return [...this.rows.values()].filter((g) => g.matchId === matchId);
  }
  async listByLeague(leagueId: string) {
    return [...this.rows.values()].filter((g) => g.leagueId === leagueId);
  }
  async create(input: NewGame) {
    const row: Game = {
      createdAt: now(),
      matchId: null,
      leagueId: null,
      ...input,
    } as Game;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewGame>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

export class FakeInvitationRepository implements InvitationRepository {
  readonly rows = new Map<string, Invitation>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByToken(token: string) {
    for (const row of this.rows.values()) {
      if (row.token === token) return row;
    }
    return null;
  }
  async listByIssuer(ownerId: string) {
    return [...this.rows.values()].filter((i) => i.issuedByOwnerId === ownerId);
  }
  async create(input: NewInvitation) {
    const row: Invitation = {
      createdAt: now(),
      status: 'PENDING',
      memo: null,
      consumedAt: null,
      consumedByUserId: null,
      revokedAt: null,
      ...input,
    } as Invitation;
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateInput<NewInvitation>) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = applyUpdate(existing, input);
    this.rows.set(id, next);
    return next;
  }
}

export class FakeGameResultRepository implements GameResultRepository {
  readonly rows: GameResult[] = [];

  async listByGame(gameId: string) {
    return this.rows.filter((r) => r.gameId === gameId);
  }
  async createMany(inputs: NewGameResult[]) {
    const created = inputs.map((input) => ({ tobiRole: null, ...input }) as GameResult);
    this.rows.push(...created);
    return created;
  }
  async replaceForGame(gameId: string, inputs: NewGameResult[]) {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].gameId === gameId) this.rows.splice(i, 1);
    }
    return this.createMany(inputs);
  }
  async deleteByGame(gameId: string) {
    let removed = 0;
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].gameId === gameId) {
        this.rows.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }
}
