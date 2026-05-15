/**
 * OwnerService — CRUD for the `owners` entity.
 *
 * Owners carry no cross-table integrity rules in MVP, so this service is a
 * straight pass-through over the repository. It exists primarily to give the
 * upper layers (server functions, route loaders) one place to import from per
 * entity, which keeps the call-sites symmetrical with PlayerService /
 * GameService that *do* hold rules.
 */

import type { NewOwner, Owner } from '../db/schema';
import type { OwnerRepository } from '../repositories/interfaces';

export class OwnerService {
  constructor(private readonly repo: OwnerRepository) {}

  findById(id: string): Promise<Owner | null> {
    return this.repo.findById(id);
  }

  findByEmail(email: string): Promise<Owner | null> {
    return this.repo.findByEmail(email);
  }

  create(input: NewOwner): Promise<Owner> {
    return this.repo.create(input);
  }

  update(id: string, input: Partial<Omit<NewOwner, 'id'>>): Promise<Owner | null> {
    return this.repo.update(id, input);
  }

  delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}
