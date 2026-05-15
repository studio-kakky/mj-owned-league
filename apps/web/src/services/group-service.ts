/**
 * GroupService — CRUD plus the two cross-table flows that the Group lifecycle
 * needs.
 *
 *  1. `createWithDefaultRuleset` — `02-domain-model.md` § Ruleset の解決順序
 *     says "Group 作成時にデフォルト Ruleset を 1 つ自動作成し、
 *     `defaultRulesetId` に設定する運用とする". This is the orchestration
 *     for that: create the Group, create the default Ruleset, update the
 *     Group to point at it.
 *
 *  2. `deleteIfNoHistory` — Group deletion is not explicitly speced in
 *     `02-domain-model.md`, but the only safe deletion semantics for the
 *     MVP is the same "history-aware" rule we use for Players: if the
 *     Group has any `Game` rows (= persisted history), physical deletion
 *     would silently wipe historical records (everything cascades from
 *     Group in the schema). We block it and surface `GroupHasHistoryError`
 *     so the caller can offer a different recovery path (rename, archive
 *     later, etc.). Empty Groups can be deleted.
 *
 * The plain CRUD (findById / listByOwner / create / update / delete) is
 * preserved unchanged so existing call sites — Drizzle-backed repos, future
 * server functions — keep working.
 */

import type { Group, NewGroup, NewRuleset, Ruleset, UmaPattern } from '../db/schema';
import type {
  GameRepository,
  GroupRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { DomainError } from './errors';

/**
 * Thrown by `deleteIfNoHistory` when the Group still has Games attached.
 * Mirrors the shape of `PlayerHasHistoryError` so the UI can pattern-match
 * across history-aware deletes uniformly.
 */
export class GroupHasHistoryError extends DomainError {
  constructor(
    public readonly groupId: string,
    public readonly gameCount: number,
  ) {
    super(`Group ${groupId} has ${gameCount} game(s) and cannot be physically deleted`);
  }
}

/**
 * Defaults applied to the auto-generated Ruleset created alongside a new Group.
 * Lifted from the canonical example in `02-domain-model.md` § オカ:
 * 25000-mochi / 30000-gaeshi / 4-player. The uma pattern defaults to
 * `UMA_10_30` (the most common 4-player table). The Owner can edit the
 * Ruleset afterwards via Settings (S16).
 *
 * Export so tests can assert on the exact defaults without re-declaring them.
 */
export const DEFAULT_RULESET_NAME = '標準ルール';
export const DEFAULT_RULESET_STARTING_SCORE = 25000;
export const DEFAULT_RULESET_RETURN_SCORE = 30000;
export const DEFAULT_RULESET_UMA_PATTERN: UmaPattern = 'UMA_10_30';

export interface GroupServiceDeps {
  /** Required for the legacy CRUD methods + the orchestration flows. */
  groups: GroupRepository;
  /**
   * Required by `createWithDefaultRuleset`. Optional so existing test setups
   * that only exercise the bare CRUD methods do not have to construct a
   * RulesetRepository they never use.
   */
  rulesets?: RulesetRepository;
  /**
   * Required by `deleteIfNoHistory`. Optional for the same reason as
   * `rulesets` above. Repository access is read-only — we only need
   * `listByGroup` to count history.
   */
  games?: Pick<GameRepository, 'listByGroup'>;
  /**
   * UUID factory. Injected so tests can use deterministic ids and so the
   * implementation does not bake in a global `crypto.randomUUID` dependency
   * (Workers + jsdom both expose it, but explicit > implicit).
   */
  generateId?: () => string;
}

export class GroupService {
  private readonly groups: GroupRepository;
  private readonly rulesets: RulesetRepository | undefined;
  private readonly games: Pick<GameRepository, 'listByGroup'> | undefined;
  private readonly generateId: () => string;

  /**
   * Two-overload constructor:
   *   - `new GroupService(repo)` — legacy shape used by existing call sites
   *     and prior tests. Equivalent to `{ groups: repo }`.
   *   - `new GroupService({ groups, rulesets, games, generateId })` — full
   *     dependency bundle for the new orchestration methods.
   */
  constructor(deps: GroupRepository | GroupServiceDeps) {
    if (isGroupRepository(deps)) {
      this.groups = deps;
      this.rulesets = undefined;
      this.games = undefined;
    } else {
      this.groups = deps.groups;
      this.rulesets = deps.rulesets;
      this.games = deps.games;
    }
    const explicitId =
      !isGroupRepository(deps) && deps.generateId !== undefined ? deps.generateId : null;
    this.generateId = explicitId ?? (() => globalThis.crypto.randomUUID());
  }

  findById(id: string): Promise<Group | null> {
    return this.groups.findById(id);
  }

  listByOwner(ownerId: string): Promise<Group[]> {
    return this.groups.listByOwner(ownerId);
  }

  create(input: NewGroup): Promise<Group> {
    return this.groups.create(input);
  }

  update(id: string, input: Partial<Omit<NewGroup, 'id'>>): Promise<Group | null> {
    return this.groups.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.groups.delete(id);
  }

  /**
   * Creates a new Group together with its default Ruleset, then points
   * `group.defaultRulesetId` at the freshly created Ruleset.
   *
   * Not transactional in the SQLite sense — D1 wraps the three writes in
   * three separate statements. The chosen ordering (Group → Ruleset → update
   * Group) means that a crash between steps 2 and 3 leaves an orphaned
   * Ruleset and a Group with `defaultRulesetId = null`, which is recoverable
   * (the Owner can re-pick a default in Settings). A crash between 1 and 2
   * leaves a Group with no Ruleset, which is also recoverable.
   *
   * If `rulesets` was not injected the call throws synchronously to surface
   * the misconfiguration as early as possible.
   */
  async createWithDefaultRuleset(input: {
    ownerId: string;
    name: string;
  }): Promise<{ group: Group; ruleset: Ruleset }> {
    if (this.rulesets === undefined) {
      throw new Error(
        'GroupService.createWithDefaultRuleset requires the `rulesets` dependency to be injected.',
      );
    }

    const groupId = this.generateId();
    const group = await this.groups.create({
      id: groupId,
      ownerId: input.ownerId,
      name: input.name,
      defaultRulesetId: null,
    });

    const rulesetInput: NewRuleset = {
      id: this.generateId(),
      groupId: group.id,
      name: DEFAULT_RULESET_NAME,
      startingScore: DEFAULT_RULESET_STARTING_SCORE,
      returnScore: DEFAULT_RULESET_RETURN_SCORE,
      umaPattern: DEFAULT_RULESET_UMA_PATTERN,
      tobiEnabled: false,
      tobiPoint: null,
    };
    const ruleset = await this.rulesets.create(rulesetInput);

    const updated = await this.groups.update(group.id, { defaultRulesetId: ruleset.id });

    return { group: updated ?? group, ruleset };
  }

  /**
   * Renames an existing Group. Convenience wrapper around `update` so the UI
   * does not have to construct a `Partial<NewGroup>` payload for the only
   * editable field in the MVP.
   */
  rename(id: string, name: string): Promise<Group | null> {
    return this.groups.update(id, { name });
  }

  /**
   * Returns `true` if the Group has at least one Game row attached. The UI
   * uses this to switch the delete-confirmation modal between "削除する"
   * and "履歴があるため削除できません" copy.
   *
   * Requires the `games` dependency.
   */
  async hasHistory(id: string): Promise<boolean> {
    if (this.games === undefined) {
      throw new Error('GroupService.hasHistory requires the `games` dependency to be injected.');
    }
    const games = await this.games.listByGroup(id);
    return games.length > 0;
  }

  /**
   * Counterpart to `PlayerService.delete`: throws `GroupHasHistoryError` if
   * any Game references this Group, otherwise delegates to `repo.delete`.
   * Empty Groups (no Games) delete successfully.
   *
   * Requires the `games` dependency.
   */
  async deleteIfNoHistory(id: string): Promise<boolean> {
    if (this.games === undefined) {
      throw new Error(
        'GroupService.deleteIfNoHistory requires the `games` dependency to be injected.',
      );
    }
    const games = await this.games.listByGroup(id);
    if (games.length > 0) {
      throw new GroupHasHistoryError(id, games.length);
    }
    return this.groups.delete(id);
  }
}

/**
 * Narrowing helper for the constructor overload. We test for one of the
 * methods unique to `GroupRepository` (vs. the deps object's shape) so the
 * check works even when both shapes carry no `groups` key.
 */
function isGroupRepository(value: GroupRepository | GroupServiceDeps): value is GroupRepository {
  return typeof (value as GroupRepository).listByOwner === 'function';
}
