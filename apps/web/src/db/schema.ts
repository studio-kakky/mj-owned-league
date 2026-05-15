/**
 * Drizzle schema for the JANROKU D1 database.
 *
 * Issue #6 scope: only the Drizzle / drizzle-kit foundation. The real domain
 * entities (Owner / Group / Player / ...) defined in
 * `docs/docs/02-domain-model.md` are introduced in #9.
 *
 * The single `pingChecks` table here exists purely as a round-trip smoke test
 * for the migration toolchain. It is safe to remove once #9 lands a real
 * schema, but keeping a trivial table is also fine — it adds no production
 * surface area.
 */

import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pingChecks = sqliteTable('ping_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export type PingCheck = typeof pingChecks.$inferSelect;
export type NewPingCheck = typeof pingChecks.$inferInsert;
