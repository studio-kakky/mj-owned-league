/**
 * In-memory repository implementations backed by the process-wide
 * `GroupServerStore` (Issue #39).
 *
 * These were previously duplicated across every `src/server/*.ts` module
 * (each declared its own `MemoryGroupRepository` / `MemoryGameRepository` /
 * …). They are consolidated here so:
 *   - there is exactly one implementation per entity, and
 *   - each server module's `makeRepos(db?)` factory can pick the in-memory
 *     backing (no `db`) or the Drizzle backing (a `db`) without re-declaring
 *     the memory classes.
 *
 * Behaviour mirrors the Drizzle repositories in `../repositories/drizzle.ts`
 * 1:1 at the interface level; the difference is purely the storage (Map vs.
 * D1). The store is shared across all repositories so a write through one
 * (e.g. create a Group) is visible through another (e.g. list that owner's
 * Groups) within the same dev session — the same guarantee D1 gives in
 * production.
 *
 * Why not reuse `tests/unit/services/fakes.ts`:
 *   The fakes start empty per `it`. This store persists across server-function
 *   invocations within a single `vite dev` run, which is exactly the
 *   "pretend D1 is wired" behaviour the dev seed relies on.
 */

import type {
  Game,
  GameResult,
  Group,
  Invitation,
  League,
  Match,
  Owner,
  Player,
  Ruleset,
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
} from '../repositories/interfaces';
import { type GroupServerStore, gameResultKey, type InMemoryStoreShape } from './groups-store';

type UpdateInput<T> = Partial<Omit<T, 'id'>>;

export class MemoryOwnerRepository implements OwnerRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Owner | null> {
    return this.store.owners.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<Owner | null> {
    return [...this.store.owners.values()].find((o) => o.email === email) ?? null;
  }

  async create(input: InMemoryStoreShape['owners']): Promise<Owner> {
    const row: Owner = {
      activeGroupId: null,
      createdAt: new Date().toISOString(),
      ...input,
    } as Owner;
    this.store.owners.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<Owner>): Promise<Owner | null> {
    const existing = this.store.owners.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.owners.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.owners.delete(id);
  }
}

export class MemoryGroupRepository implements GroupRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Group | null> {
    return this.store.groups.get(id) ?? null;
  }

  async listByOwner(ownerId: string): Promise<Group[]> {
    return [...this.store.groups.values()].filter((g) => g.ownerId === ownerId);
  }

  async create(input: InMemoryStoreShape['groups']): Promise<Group> {
    const row: Group = {
      createdAt: new Date().toISOString(),
      defaultRulesetId: null,
      ...input,
    } as Group;
    this.store.groups.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<Group>): Promise<Group | null> {
    const existing = this.store.groups.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.groups.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.groups.delete(id);
  }
}

export class MemoryRulesetRepository implements RulesetRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Ruleset | null> {
    return this.store.rulesets.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Ruleset[]> {
    return [...this.store.rulesets.values()].filter((r) => r.groupId === groupId);
  }

  async create(input: InMemoryStoreShape['rulesets']): Promise<Ruleset> {
    const row: Ruleset = {
      tobiEnabled: false,
      tobiPoint: null,
      ...input,
    } as Ruleset;
    this.store.rulesets.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<Ruleset>): Promise<Ruleset | null> {
    const existing = this.store.rulesets.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.rulesets.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.rulesets.delete(id);
  }
}

export class MemoryPlayerRepository implements PlayerRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Player | null> {
    return this.store.players.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Player[]> {
    return [...this.store.players.values()].filter((p) => p.groupId === groupId);
  }

  async create(input: InMemoryStoreShape['players']): Promise<Player> {
    const row: Player = {
      createdAt: new Date().toISOString(),
      isActive: true,
      ...input,
    } as Player;
    this.store.players.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<Player>): Promise<Player | null> {
    const existing = this.store.players.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.players.set(id, next);
    return next;
  }

  async hasGameHistory(id: string): Promise<boolean> {
    // GameResult rows carry `playerId`; a Player has history when any result
    // references it. The store now models GameResult (see `groups-store.ts`),
    // so this is no longer hard-coded to `false`.
    for (const result of this.store.gameResults.values()) {
      if (result.playerId === id) return true;
    }
    return false;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.players.delete(id);
  }
}

export class MemoryLeagueRepository implements LeagueRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<League | null> {
    return this.store.leagues.get(id) ?? null;
  }

  async findByPublicSlug(publicSlug: string): Promise<League | null> {
    for (const row of this.store.leagues.values()) {
      if (row.publicSlug === publicSlug) return row;
    }
    return null;
  }

  async listByGroup(groupId: string): Promise<League[]> {
    return [...this.store.leagues.values()].filter((l) => l.groupId === groupId);
  }

  async create(input: InMemoryStoreShape['leagues']): Promise<League> {
    const row: League = {
      createdAt: new Date().toISOString(),
      defaultRulesetId: null,
      ...input,
    } as League;
    this.store.leagues.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<League>): Promise<League | null> {
    const existing = this.store.leagues.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.leagues.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.leagues.delete(id);
  }
}

export class MemoryMatchRepository implements MatchRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Match | null> {
    return this.store.matches.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Match[]> {
    return [...this.store.matches.values()].filter((m) => m.groupId === groupId);
  }

  async listByLeague(leagueId: string): Promise<Match[]> {
    return [...this.store.matches.values()].filter((m) => m.leagueId === leagueId);
  }

  async create(input: InMemoryStoreShape['matches']): Promise<Match> {
    const row: Match = {
      createdAt: new Date().toISOString(),
      leagueId: null,
      sequenceNumber: null,
      heldAt: null,
      memo: null,
      defaultRulesetId: null,
      ...input,
    } as Match;
    this.store.matches.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<Match>): Promise<Match | null> {
    const existing = this.store.matches.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.matches.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.matches.delete(id);
  }
}

export class MemoryGameRepository implements GameRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Game | null> {
    return this.store.games.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.groupId === groupId);
  }

  async listByMatch(matchId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.matchId === matchId);
  }

  async listByLeague(leagueId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.leagueId === leagueId);
  }

  async create(input: InMemoryStoreShape['games']): Promise<Game> {
    const row: Game = {
      createdAt: new Date().toISOString(),
      matchId: null,
      leagueId: null,
      ...input,
    } as Game;
    this.store.games.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<Game>): Promise<Game | null> {
    const existing = this.store.games.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.games.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.games.delete(id);
  }
}

export class MemoryGameResultRepository implements GameResultRepository {
  constructor(private readonly store: GroupServerStore) {}

  async listByGame(gameId: string): Promise<GameResult[]> {
    return [...this.store.gameResults.values()].filter((r) => r.gameId === gameId);
  }

  async createMany(inputs: InMemoryStoreShape['gameResults'][]): Promise<GameResult[]> {
    const created: GameResult[] = [];
    for (const input of inputs) {
      const row: GameResult = { tobiRole: null, ...input } as GameResult;
      this.store.gameResults.set(gameResultKey(row.gameId, row.playerId), row);
      created.push(row);
    }
    return created;
  }

  async replaceForGame(
    gameId: string,
    inputs: InMemoryStoreShape['gameResults'][],
  ): Promise<GameResult[]> {
    await this.deleteByGame(gameId);
    return this.createMany(inputs);
  }

  async deleteByGame(gameId: string): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.store.gameResults.entries()) {
      if (row.gameId === gameId) {
        this.store.gameResults.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

export class MemoryInvitationRepository implements InvitationRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Invitation | null> {
    return this.store.invitations.get(id) ?? null;
  }

  async findByToken(token: string): Promise<Invitation | null> {
    for (const row of this.store.invitations.values()) {
      if (row.token === token) return row;
    }
    return null;
  }

  async listByIssuer(ownerId: string): Promise<Invitation[]> {
    return [...this.store.invitations.values()].filter((i) => i.issuedByOwnerId === ownerId);
  }

  async create(input: InMemoryStoreShape['invitations']): Promise<Invitation> {
    const row: Invitation = {
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      memo: null,
      consumedAt: null,
      consumedByUserId: null,
      revokedAt: null,
      ...input,
    } as Invitation;
    this.store.invitations.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateInput<Invitation>): Promise<Invitation | null> {
    const existing = this.store.invitations.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.invitations.set(id, next);
    return next;
  }
}
