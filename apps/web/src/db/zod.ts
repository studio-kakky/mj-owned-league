/**
 * Zod schemas derived from the Drizzle schema via `drizzle-zod`.
 *
 * Purpose for issue #6: prove that `drizzle-zod` is wired up and that
 * select / insert / update schemas can be generated from a table definition.
 * #9 will extend this pattern across the real domain entities.
 *
 * Why split this out from `schema.ts`?
 *   - `schema.ts` is imported by the Workers runtime; keeping it free of the
 *     `drizzle-zod` dependency keeps the Worker bundle smaller.
 *   - The Zod schemas are typically used by server functions / API handlers
 *     for request validation, which is a separate concern from the table
 *     definition itself.
 */

import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { pingChecks } from './schema';

export const selectPingCheckSchema = createSelectSchema(pingChecks);
export const insertPingCheckSchema = createInsertSchema(pingChecks);
export const updatePingCheckSchema = createUpdateSchema(pingChecks);
