import { describe, expect, it } from 'vitest';
import {
  insertPingCheckSchema,
  selectPingCheckSchema,
  updatePingCheckSchema,
} from '../../../src/db/zod';

/**
 * Smoke test for the drizzle-zod integration (issue #6).
 *
 * We don't aim to exhaustively cover Zod behaviour here — that lives in the
 * library's own test suite. The goal is to prove that schema generation from
 * the Drizzle table definition is wired up and produces working Zod parsers,
 * so that #9 can extend the same pattern across the real domain entities.
 */
describe('drizzle-zod ping_checks schemas', () => {
  it('rejects an insert payload missing the required label', () => {
    const result = insertPingCheckSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts a minimal insert payload (label only)', () => {
    const result = insertPingCheckSchema.safeParse({ label: 'hello' });
    expect(result.success).toBe(true);
  });

  it('parses a select row with all server-populated columns', () => {
    const result = selectPingCheckSchema.safeParse({
      id: 1,
      label: 'hello',
      createdAt: '2026-05-15 02:06:32',
    });
    expect(result.success).toBe(true);
  });

  it('treats every field as optional in the update schema', () => {
    const result = updatePingCheckSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
