/**
 * Presentational tests for the S6 Group 詳細 (ホーム) screen (Issue #16).
 *
 * Same mocking strategy as `DashboardScreen.test.tsx` / `LeagueDetailScreen.test.tsx`:
 * the TanStack Router `<Link>` is replaced with a plain anchor so the test
 * does not have to spin up a router. The shape we care about is "renders
 * something that points at `to` with the right `search` / `params`"; we
 * serialise that into queryable attributes.
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    search,
    children,
    className,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    children: React.ReactNode;
    className?: string;
  } & Record<string, unknown>) => (
    <a
      href={to}
      className={className}
      data-search={search ? JSON.stringify(search) : undefined}
      data-params={params ? JSON.stringify(params) : undefined}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import { GroupHomeScreen } from '../../../../src/components/group-home/GroupHomeScreen';
import type { GroupHomeData } from '../../../../src/components/group-home/types';

const baseData: GroupHomeData = {
  id: 'g1',
  name: '金曜定例会',
  createdAt: '2026-01-15T00:00:00.000Z',
  activePlayerCount: 4,
  totalGameCount: 5,
  lastPlayedAt: '2026-05-08T00:00:00.000Z',
  leagues: [
    {
      id: 'l1',
      name: '2026 春シーズン',
      matchCount: 2,
      gameCount: 5,
      lastPlayedAt: '2026-05-08T00:00:00.000Z',
    },
  ],
  matches: [
    {
      id: 'm1',
      leagueId: 'l1',
      leagueName: '2026 春シーズン',
      name: '第 1 節',
      sequenceNumber: 1,
      heldAt: '2026-05-08',
      gameCount: 5,
    },
  ],
  ranking: [
    {
      playerId: 'p1',
      playerName: 'たかし',
      gameCount: 5,
      totalPoints: 65,
      averagePoints: 13,
      topCount: 3,
      lastCount: 0,
    },
    {
      playerId: 'p2',
      playerName: 'なお',
      gameCount: 5,
      totalPoints: 12,
      averagePoints: 2.4,
      topCount: 1,
      lastCount: 1,
    },
  ],
  recentGames: [
    {
      id: 'game-1',
      matchId: 'm1',
      matchName: '第 1 節',
      leagueId: 'l1',
      leagueName: '2026 春シーズン',
      playedAt: '2026-05-08T00:00:00.000Z',
    },
  ],
};

const emptyData: GroupHomeData = {
  id: 'g2',
  name: '会社の同期会',
  createdAt: '2026-02-01T00:00:00.000Z',
  activePlayerCount: 0,
  totalGameCount: 0,
  lastPlayedAt: null,
  leagues: [],
  matches: [],
  ranking: [],
  recentGames: [],
};

describe('GroupHomeScreen', () => {
  it('renders the Group name in the page title', () => {
    render(<GroupHomeScreen data={baseData} />);
    expect(screen.getByRole('heading', { level: 1, name: '金曜定例会' })).toBeInTheDocument();
  });

  it('surfaces the active player count, game count, and last-played date in the header', () => {
    render(<GroupHomeScreen data={baseData} />);
    expect(screen.getByTestId('group-home-summary-players')).toHaveTextContent('4 人');
    expect(screen.getByTestId('group-home-summary-games')).toHaveTextContent('5 局');
    expect(screen.getByTestId('group-home-summary-last-played')).toHaveTextContent('2026/05/08');
  });

  it('falls back to "未対局" in the last-played summary when no Games have been recorded', () => {
    render(<GroupHomeScreen data={emptyData} />);
    expect(screen.getByTestId('group-home-summary-last-played')).toHaveTextContent('未対局');
  });

  it('links Player 管理 / Ruleset 管理 to /groups/$groupId/settings with the matching groupId', () => {
    render(<GroupHomeScreen data={baseData} />);

    const playersLink = screen.getByTestId('group-home-settings-players-link');
    expect(playersLink).toHaveAttribute('href', '/groups/$groupId/settings');
    expect(playersLink.getAttribute('data-params')).toBe(JSON.stringify({ groupId: 'g1' }));

    const rulesetsLink = screen.getByTestId('group-home-settings-rulesets-link');
    expect(rulesetsLink).toHaveAttribute('href', '/groups/$groupId/settings');
    expect(rulesetsLink.getAttribute('data-params')).toBe(JSON.stringify({ groupId: 'g1' }));
  });

  it('renders the leagues section with a "もっと見る" link to /leagues?groupId=…', () => {
    render(<GroupHomeScreen data={baseData} />);
    const section = screen.getByTestId('group-home-leagues-section');
    const more = within(section).getByTestId('group-home-leagues-section-more');
    expect(more).toHaveAttribute('href', '/leagues');
    expect(more.getAttribute('data-search')).toBe(JSON.stringify({ groupId: 'g1' }));
    expect(screen.getByTestId('group-home-league-row-l1')).toBeInTheDocument();
  });

  it('renders the matches section with a "もっと見る" link to /matches?groupId=…', () => {
    render(<GroupHomeScreen data={baseData} />);
    const section = screen.getByTestId('group-home-matches-section');
    const more = within(section).getByTestId('group-home-matches-section-more');
    expect(more).toHaveAttribute('href', '/matches');
    expect(more.getAttribute('data-search')).toBe(JSON.stringify({ groupId: 'g1' }));
    expect(screen.getByTestId('group-home-match-row-m1')).toBeInTheDocument();
  });

  it('shows the ranking table sorted by totalPoints desc', () => {
    render(<GroupHomeScreen data={baseData} />);
    const rows = screen.getAllByTestId(/group-home-ranking-row-/);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('たかし');
    expect(rows[1]).toHaveTextContent('なお');
  });

  it('shows the empty-state when no GameResults have been recorded', () => {
    render(<GroupHomeScreen data={emptyData} />);
    expect(screen.getByTestId('group-home-ranking-empty')).toBeInTheDocument();
    expect(screen.queryByTestId(/group-home-ranking-row-/)).not.toBeInTheDocument();
  });

  it('renders the recent-games feed entries with the date and Match name', () => {
    render(<GroupHomeScreen data={baseData} />);
    const row = screen.getByTestId('group-home-recent-game-row-game-1');
    expect(row).toHaveTextContent('第 1 節');
    expect(row).toHaveTextContent('2026/05/08');
  });

  it('falls back to "League 外" when a recent game has no associated League', () => {
    const noLeagueData: GroupHomeData = {
      ...baseData,
      recentGames: [
        {
          id: 'game-2',
          matchId: null,
          matchName: null,
          leagueId: null,
          leagueName: null,
          playedAt: '2026-05-10T00:00:00.000Z',
        },
      ],
    };
    render(<GroupHomeScreen data={noLeagueData} />);
    const row = screen.getByTestId('group-home-recent-game-row-game-2');
    expect(row).toHaveTextContent('カジュアル対局');
    expect(row).toHaveTextContent('League 外');
  });

  it('renders empty-state CTAs that pre-fill the Group filter', () => {
    render(<GroupHomeScreen data={emptyData} />);
    const leaguesEmpty = screen.getByTestId('group-home-leagues-empty');
    const ctaLeagues = within(leaguesEmpty).getByRole('link');
    expect(ctaLeagues).toHaveAttribute('href', '/leagues');
    expect(ctaLeagues.getAttribute('data-search')).toBe(JSON.stringify({ groupId: 'g2' }));

    const matchesEmpty = screen.getByTestId('group-home-matches-empty');
    const ctaMatches = within(matchesEmpty).getByRole('link');
    expect(ctaMatches).toHaveAttribute('href', '/matches');
    expect(ctaMatches.getAttribute('data-search')).toBe(JSON.stringify({ groupId: 'g2' }));
  });
});
