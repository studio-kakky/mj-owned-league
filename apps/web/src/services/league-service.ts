/**
 * LeagueService — CRUD for the `leagues` entity.
 *
 * No cross-table rules are enforced here in MVP. The `format`-immutability
 * rule from `02-domain-model.md` § League ("途中で 4 人 ↔ 3 人 や 半荘 ↔ 東風
 * の切り替えは不可") is documented but not policed at the service layer yet —
 * the UI does not surface a format-change control, and adding a service-level
 * guard would require fetching the current row on every update. We'll
 * re-introduce it the moment a feature lets users edit Leagues post-creation.
 *
 * `publicSlug` generation is the caller's responsibility (a route-level
 * concern: the slug must be a hard-to-guess random string per
 * `02-domain-model.md`). We don't generate it here because doing so would
 * couple the domain layer to a randomness source.
 */

import type { League, NewLeague } from '../db/schema';
import type { LeagueRepository } from '../repositories/interfaces';

export class LeagueService {
  constructor(private readonly repo: LeagueRepository) {}

  findById(id: string): Promise<League | null> {
    return this.repo.findById(id);
  }

  findByPublicSlug(publicSlug: string): Promise<League | null> {
    return this.repo.findByPublicSlug(publicSlug);
  }

  listByGroup(groupId: string): Promise<League[]> {
    return this.repo.listByGroup(groupId);
  }

  create(input: NewLeague): Promise<League> {
    return this.repo.create(input);
  }

  update(id: string, input: Partial<Omit<NewLeague, 'id'>>): Promise<League | null> {
    return this.repo.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}
