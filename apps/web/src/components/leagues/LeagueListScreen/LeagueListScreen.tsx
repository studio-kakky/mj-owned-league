/**
 * S15 League 一覧 screen (`04-screens.md` § S15, Issue #18 / #60).
 *
 * Scope: the active Group's League list with status filter + create modal.
 * Hosted at `/groups/:groupId/leagues` (Issue #60) — the `groupId` comes from
 * the URL path, so the list is always scoped to a single Group and the cards
 * no longer carry a Group label.
 *
 *   - "League 一覧（フィルタ別）" — the issue acceptance criterion. The
 *     filter pills (`すべて` / `進行中` / `終了`) live in the page header.
 *
 *   - "新規作成モーダル" — wired to {@link LeagueFormModal}. The Group is
 *     fixed to the one in the path (the dropdown collapses to a single
 *     option), so no Group-picker round trip is needed.
 *
 *   - "終了" filter currently returns 0 because the schema does not yet
 *     carry an `endedAt` column. The pill is still rendered so the
 *     interaction matches the design; switching to a real predicate is a
 *     one-line change in the server's projection.
 *
 * Presentational boundary mirrors `GroupsScreen` and `DashboardScreen`:
 *   - Takes the projected payload + a `onCreateLeague` callback as props.
 *   - No data fetching; the route loader owns the round trip.
 *   - The card click navigates to `/groups/$groupId/leagues/$leagueId`
 *     (S7 detail).
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
  /**
   * The Group this list is scoped to (from the URL path). Used to build the
   * group-scoped detail links (`/groups/$groupId/leagues/$leagueId`).
   */
  groupId: string;
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

const STATUS_LABELS: Readonly<Record<LeagueListItem['status'], string>> = {
  ACTIVE: '進行中',
  ENDED: '終了',
};

/** Right chevron + status badge — design `LeagueList.html`. */
const ChevronRight = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-[#888888]"
  >
    <title>開く</title>
    <path d="M5 3 L9 7 L5 11" />
  </svg>
);

const StatusBadge = ({ status }: { status: LeagueListItem['status'] }) => {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`shrink-0 rounded-[3px] border px-1.5 py-px font-mono text-[10px] tracking-[0.04em] ${
        isActive ? 'border-[#3a3a3a] text-[#FAFAF8]' : 'border-[#1F1F1F] text-[#666666]'
      }`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
};

const MetaDot = () => <span className="text-[#3a3a3a]">·</span>;

export const LeagueListScreen = ({
  groupId,
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

  const counts = useMemo(
    () => ({
      ALL: leagues.length,
      ACTIVE: leagues.filter((l) => l.status === 'ACTIVE').length,
      ENDED: leagues.filter((l) => l.status === 'ENDED').length,
    }),
    [leagues],
  );

  const hasGroups = groups.length > 0;

  return (
    <section className="-mx-4 -mt-4 font-sans" data-testid="leagues-screen">
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[#FAFAF8]">リーグ</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={!hasGroups}
          data-testid="leagues-create-trigger"
          aria-label="リーグを作成"
          className="flex shrink-0 items-center gap-1 rounded-full border border-[#2d2d2d] px-3 py-1.5 text-xs font-medium text-[#FAFAF8] transition-colors hover:border-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true" className="-mt-px text-sm leading-none">
            +
          </span>
          <span>新規</span>
        </button>
      </div>

      <FilterPills active={filter} counts={counts} onChange={setFilter} />

      {filtered.length === 0 ? (
        <div className="px-5 pt-3.5">
          <EmptyState filter={filter} hasAnyLeague={leagues.length > 0} hasGroups={hasGroups} />
        </div>
      ) : (
        <ul className="mt-3.5" data-testid="leagues-list">
          {filtered.map((league) => (
            <li key={league.id} data-testid={`leagues-list-item-${league.id}`}>
              <Link
                to="/groups/$groupId/leagues/$leagueId"
                params={{ groupId, leagueId: league.id }}
                className="flex items-center justify-between gap-3 border-t border-[#1F1F1F] px-5 py-4 transition-colors [&:last-child]:border-b hover:bg-[#141414]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-[#FAFAF8]">
                      {league.name}
                    </span>
                    <StatusBadge status={league.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11.5px] text-[#666666]">
                    <span>{FORMAT_LABELS[league.format]}</span>
                    <MetaDot />
                    <span>{league.playerCount}人</span>
                    <MetaDot />
                    <span>{league.matchCount} マッチ</span>
                    <MetaDot />
                    <span>
                      {league.lastPlayedAt === null ? '未対局' : formatDate(league.lastPlayedAt)}
                    </span>
                  </div>
                </div>
                <ChevronRight />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="h-4" />

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
