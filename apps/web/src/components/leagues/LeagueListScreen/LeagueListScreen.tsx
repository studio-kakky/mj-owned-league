/**
 * S7 / S15 League 一覧 screen (`04-screens.md` § S7 / S15, Issue #18).
 *
 * MVP scope: cross-Group League list with status filter + create modal.
 *
 *   - "League 一覧（フィルタ別）" — the issue acceptance criterion. The
 *     filter pills (`すべて` / `進行中` / `終了`) live in the page header.
 *     `04-screens.md` § S15 says the list lives at `/groups/:groupId/leagues`;
 *     for MVP we host it at `/leagues` because (a) the bottom nav already
 *     points there and (b) Owners typically have few Groups, so showing
 *     every League with a Group-label on each card keeps the view useful
 *     without forcing per-Group navigation.
 *
 *   - "新規作成モーダル" — wired to {@link LeagueFormModal}. Disabled when
 *     the Owner has no Groups yet (we point them at S4 instead).
 *
 *   - "終了" filter currently returns 0 because the schema does not yet
 *     carry an `endedAt` column. The pill is still rendered so the
 *     interaction matches the design; switching to a real predicate is a
 *     one-line change in the server's projection.
 *
 * Presentational boundary mirrors `GroupsScreen` and `DashboardScreen`:
 *   - Takes the projected payload + a `onCreateLeague` callback as props.
 *   - No data fetching; the route loader owns the round trip.
 *   - The card click navigates to `/leagues/$leagueId` (S7 detail).
 */

import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { LeagueFormat } from '../../../db/schema';
import { LeagueFormModal } from '../LeagueFormModal';
import type {
  LeagueCreateInput,
  LeagueGroupOption,
  LeagueListFilter,
  LeagueListItem,
  LeagueRulesetOptionWithGroup,
} from '../types';
import { EmptyState } from './EmptyState';
import { FilterPills } from './FilterPills';

export interface LeagueListScreenProps {
  leagues: ReadonlyArray<LeagueListItem>;
  groups: ReadonlyArray<LeagueGroupOption>;
  rulesets: ReadonlyArray<LeagueRulesetOptionWithGroup>;
  /**
   * Called with the validated form payload when the user submits the
   * create modal. Should resolve once the new League is persisted; the
   * modal stays open until it does.
   */
  onCreateLeague: (input: LeagueCreateInput) => void | Promise<void>;
}

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

export const LeagueListScreen = ({
  leagues,
  groups,
  rulesets,
  onCreateLeague,
}: LeagueListScreenProps) => {
  const [filter, setFilter] = useState<LeagueListFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return leagues;
    return leagues.filter((league) => league.status === filter);
  }, [leagues, filter]);

  const hasGroups = groups.length > 0;

  return (
    <section className="space-y-5" data-testid="leagues-screen">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Leagues</p>
          <h1 className="text-2xl font-bold text-zinc-50">リーグ</h1>
          <p className="mt-1 text-sm text-zinc-400">
            シーズン単位で対局を束ねる入れ物です。順位表や公開 URL はここから辿れます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={!hasGroups}
          data-testid="leagues-create-trigger"
          aria-label="リーグを作成"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ＋
        </button>
      </header>

      <FilterPills active={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState filter={filter} hasAnyLeague={leagues.length > 0} hasGroups={hasGroups} />
      ) : (
        <ul className="space-y-3" data-testid="leagues-list">
          {filtered.map((league) => (
            <li key={league.id} data-testid={`leagues-list-item-${league.id}`}>
              <Link
                to="/leagues/$leagueId"
                params={{ leagueId: league.id }}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{league.name}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {league.groupName} / {FORMAT_LABELS[league.format]} / マッチ{' '}
                      {league.matchCount} 件 / 対局 {league.gameCount} 件
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {league.lastPlayedAt === null ? '未対局' : formatDate(league.lastPlayedAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <LeagueFormModal
        open={createOpen}
        groups={groups}
        rulesets={rulesets}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          await onCreateLeague(input);
          setCreateOpen(false);
        }}
      />
    </section>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * ISO date / datetime → `YYYY/MM/DD`. Duplicated with the same helper in
 * `GroupsScreen` and `DashboardScreen` — see those files for the
 * "promote on third duplicate" rule.
 */
const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};
