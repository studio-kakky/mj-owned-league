/**
 * GroupService — CRUD for the `groups` entity.
 *
 * No cross-table rules in MVP; the auto-default-Ruleset creation described in
 * `02-domain-model.md` § Ruleset の解決順序 is intentionally NOT implemented
 * here — that's an end-to-end flow that belongs to whichever issue lands the
 * Group-creation UI (it spans multiple repositories and wants a single
 * transactional boundary). Keeping this service free of that orchestration
 * avoids two competing "create Group" code paths.
 */

import type { Group, NewGroup } from '../db/schema';
import type { GroupRepository } from '../repositories/interfaces';

export class GroupService {
  constructor(private readonly repo: GroupRepository) {}

  findById(id: string): Promise<Group | null> {
    return this.repo.findById(id);
  }

  listByOwner(ownerId: string): Promise<Group[]> {
    return this.repo.listByOwner(ownerId);
  }

  create(input: NewGroup): Promise<Group> {
    return this.repo.create(input);
  }

  update(id: string, input: Partial<Omit<NewGroup, 'id'>>): Promise<Group | null> {
    return this.repo.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}
