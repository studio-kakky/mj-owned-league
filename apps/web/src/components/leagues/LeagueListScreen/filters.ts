import type { LeagueListFilter } from '../types';

/**
 * Filter pills shown above the list. Order is "すべて → 進行中 → 終了" so
 * the default lands on the leftmost pill and the deactivated bucket is
 * deemphasised by being rightmost.
 */
export const FILTERS: ReadonlyArray<{ value: LeagueListFilter; label: string }> = [
  { value: 'ALL', label: 'すべて' },
  { value: 'ACTIVE', label: '進行中' },
  { value: 'ENDED', label: '終了' },
];
