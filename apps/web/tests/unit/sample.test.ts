import { describe, expect, it } from 'vitest';

describe('scaffold sanity', () => {
  it('runs an arithmetic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('matches a string with toContain', () => {
    expect('JANROKU').toContain('JAN');
  });
});
