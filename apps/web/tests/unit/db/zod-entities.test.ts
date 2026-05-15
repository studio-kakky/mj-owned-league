/**
 * Smoke tests for the drizzle-zod schemas covering the real domain entities.
 *
 * These tests aim to:
 *   1. Prove that `drizzle-zod` successfully generates Zod schemas for every
 *      table defined in `../../../src/db/schema.ts`. A typo in `schema.ts`
 *      (missing `.notNull()`, wrong column name, etc.) would surface here at
 *      test time rather than at the first production request.
 *   2. Spot-check that the column-level NOT NULL constraints carry through
 *      into the insert schema's required-field rule.
 *
 * We deliberately do NOT exhaustively cover every field combination — that
 * would re-test drizzle-zod's own behaviour. The cross-record rules
 * (matchId/leagueId consistency, raw-score sum, etc.) live in service tests.
 */

import { describe, expect, it } from 'vitest';
import {
  insertGameResultSchema,
  insertGameSchema,
  insertGroupSchema,
  insertLeagueSchema,
  insertMatchSchema,
  insertOwnerSchema,
  insertPlayerSchema,
  insertRulesetSchema,
  selectGameResultSchema,
  selectGameSchema,
  selectGroupSchema,
  selectLeagueSchema,
  selectMatchSchema,
  selectOwnerSchema,
  selectPlayerSchema,
  selectRulesetSchema,
  updateGameSchema,
  updateOwnerSchema,
  updatePlayerSchema,
  updateRulesetSchema,
} from '../../../src/db/zod';

describe('drizzle-zod domain schemas', () => {
  it('owners — accepts a minimal insert and parses a full select row', () => {
    expect(insertOwnerSchema.safeParse({ id: 'o1', email: 'a@example.com' }).success).toBe(true);
    expect(
      selectOwnerSchema.safeParse({
        id: 'o1',
        email: 'a@example.com',
        createdAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(updateOwnerSchema.safeParse({}).success).toBe(true);
  });

  it('groups — requires ownerId on insert', () => {
    expect(insertGroupSchema.safeParse({ id: 'g1', name: 'group' }).success).toBe(false);
    expect(insertGroupSchema.safeParse({ id: 'g1', ownerId: 'o1', name: 'group' }).success).toBe(
      true,
    );
    expect(
      selectGroupSchema.safeParse({
        id: 'g1',
        ownerId: 'o1',
        name: 'group',
        defaultRulesetId: null,
        createdAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('players — accepts a minimal insert with isActive defaulted server-side', () => {
    expect(insertPlayerSchema.safeParse({ id: 'p1', groupId: 'g1', name: 'Alice' }).success).toBe(
      true,
    );
    expect(
      selectPlayerSchema.safeParse({
        id: 'p1',
        groupId: 'g1',
        name: 'Alice',
        isActive: true,
        createdAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(updatePlayerSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rulesets — enforces the umaPattern enum', () => {
    expect(
      insertRulesetSchema.safeParse({
        id: 'r1',
        groupId: 'g1',
        name: 'r',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'NOT_A_REAL_PATTERN',
      }).success,
    ).toBe(false);

    expect(
      insertRulesetSchema.safeParse({
        id: 'r1',
        groupId: 'g1',
        name: 'r',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
      }).success,
    ).toBe(true);

    expect(
      selectRulesetSchema.safeParse({
        id: 'r1',
        groupId: 'g1',
        name: 'r',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        tobiEnabled: false,
        tobiPoint: null,
      }).success,
    ).toBe(true);
    expect(updateRulesetSchema.safeParse({ tobiEnabled: true, tobiPoint: 10 }).success).toBe(true);
  });

  it('leagues — enforces the format enum', () => {
    expect(
      insertLeagueSchema.safeParse({
        id: 'l1',
        groupId: 'g1',
        name: 'L',
        format: 'NOT_A_FORMAT',
        publicSlug: 'abc',
      }).success,
    ).toBe(false);
    expect(
      insertLeagueSchema.safeParse({
        id: 'l1',
        groupId: 'g1',
        name: 'L',
        format: '4P_HANCHAN',
        publicSlug: 'abc',
      }).success,
    ).toBe(true);

    expect(
      selectLeagueSchema.safeParse({
        id: 'l1',
        groupId: 'g1',
        name: 'L',
        format: '4P_HANCHAN',
        defaultRulesetId: null,
        publicSlug: 'abc',
        createdAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('matches — accepts a minimal insert (most fields optional)', () => {
    expect(insertMatchSchema.safeParse({ id: 'm1', groupId: 'g1', name: 'M1' }).success).toBe(true);

    expect(
      selectMatchSchema.safeParse({
        id: 'm1',
        groupId: 'g1',
        leagueId: null,
        name: 'M1',
        sequenceNumber: null,
        heldAt: null,
        memo: null,
        defaultRulesetId: null,
        createdAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('games — requires format, rulesetId, playedAt', () => {
    expect(
      insertGameSchema.safeParse({
        id: 'game-1',
        groupId: 'g1',
        format: '4P_HANCHAN',
        rulesetId: 'r1',
        playedAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(
      insertGameSchema.safeParse({
        id: 'game-1',
        groupId: 'g1',
        format: '4P_HANCHAN',
        // rulesetId missing
        playedAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(false);

    expect(
      selectGameSchema.safeParse({
        id: 'game-1',
        groupId: 'g1',
        matchId: null,
        leagueId: null,
        format: '4P_HANCHAN',
        rulesetId: 'r1',
        playedAt: '2026-05-15T00:00:00.000Z',
        createdAt: '2026-05-15T00:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(updateGameSchema.safeParse({ matchId: null }).success).toBe(true);
  });

  it('game_results — accepts insert and rejects an unknown tobiRole', () => {
    expect(
      insertGameResultSchema.safeParse({
        gameId: 'game-1',
        playerId: 'p1',
        rawScore: 32000,
        points: 12.0,
        rank: 1,
        tobiRole: null,
      }).success,
    ).toBe(true);

    expect(
      insertGameResultSchema.safeParse({
        gameId: 'game-1',
        playerId: 'p1',
        rawScore: 32000,
        points: 12.0,
        rank: 1,
        tobiRole: 'BYSTANDER',
      }).success,
    ).toBe(false);

    expect(
      selectGameResultSchema.safeParse({
        gameId: 'game-1',
        playerId: 'p1',
        rawScore: 32000,
        points: 12.0,
        rank: 1,
        tobiRole: null,
      }).success,
    ).toBe(true);
  });
});
