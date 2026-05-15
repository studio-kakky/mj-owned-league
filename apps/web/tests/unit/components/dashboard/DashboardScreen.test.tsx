import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// We stub TanStack Router's <Link> so we don't have to spin up a router for
// the presentational tests. The shape we care about is "renders something
// that points at `to`"; we serialise that into a plain anchor.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  } & Record<string, unknown>) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
}));

import { DashboardScreen } from '../../../../src/components/dashboard/DashboardScreen';
import type { DashboardData } from '../../../../src/components/dashboard/types';

const data: DashboardData = {
  groups: [
    {
      id: 'g1',
      name: '金曜定例会',
      playerCount: 4,
      lastPlayedAt: '2026-05-08T00:00:00.000Z',
    },
    {
      id: 'g2',
      name: '会社の同期会',
      playerCount: 0,
      lastPlayedAt: null,
    },
  ],
  activeLeagues: [
    {
      id: 'l1',
      groupId: 'g1',
      groupName: '金曜定例会',
      name: '2026 春シーズン',
      matchCount: 1,
      gameCount: 1,
      lastPlayedAt: '2026-05-08T00:00:00.000Z',
    },
  ],
  activeMatches: [
    {
      id: 'm1',
      groupId: 'g1',
      groupName: '金曜定例会',
      leagueId: 'l1',
      leagueName: '2026 春シーズン',
      name: '第 1 節',
      heldAt: '2026-05-08',
      gameCount: 1,
    },
  ],
  recentGames: [
    {
      id: 'game-1',
      groupId: 'g1',
      groupName: '金曜定例会',
      matchId: 'm1',
      matchName: '第 1 節',
      leagueId: 'l1',
      leagueName: '2026 春シーズン',
      playedAt: '2026-05-08T00:00:00.000Z',
    },
  ],
  pendingInvitationCount: 2,
};

const emptyData: DashboardData = {
  groups: [],
  activeLeagues: [],
  activeMatches: [],
  recentGames: [],
  pendingInvitationCount: 0,
};

describe('DashboardScreen', () => {
  it('renders the page header with the page title and dashboard label', () => {
    render(<DashboardScreen data={data} />);
    expect(screen.getByRole('heading', { name: 'ホーム' })).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-header')).toHaveTextContent('Dashboard');
  });

  it('renders the pending-invitation count pill as a link to /invitations (S14)', () => {
    render(<DashboardScreen data={data} />);
    const pill = screen.getByTestId('dashboard-invitations-pill');
    expect(pill).toBeInTheDocument();
    // The pill is a Link wired up to S14 (Issue #21). The Link mock at the
    // top of this file serialises `to` into the `href`, so we can assert
    // the destination without spinning up a router.
    expect(pill).toHaveAttribute('href', '/invitations');
    expect(screen.getByTestId('dashboard-invitations-count')).toHaveTextContent('2');
  });

  it('renders one card per group with player count and last-played date', () => {
    render(<DashboardScreen data={data} />);
    const list = screen.getByTestId('dashboard-groups-list');
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0] as HTMLElement).getByText('金曜定例会')).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText(/プレイヤー 4 人/)).toBeInTheDocument();
    // The second card has a null lastPlayedAt → "未対局" copy.
    expect(within(cards[1] as HTMLElement).getByText(/未対局/)).toBeInTheDocument();
  });

  it('renders one row per active league with the aggregated counts', () => {
    render(<DashboardScreen data={data} />);
    const row = screen.getByTestId('dashboard-league-row-l1');
    expect(within(row).getByText('2026 春シーズン')).toBeInTheDocument();
    expect(within(row).getByText(/金曜定例会/)).toBeInTheDocument();
    expect(within(row).getByText(/マッチ 1 件/)).toBeInTheDocument();
    expect(within(row).getByText(/対局 1 件/)).toBeInTheDocument();
  });

  it('renders one row per active match with the held-at date', () => {
    render(<DashboardScreen data={data} />);
    const row = screen.getByTestId('dashboard-match-row-m1');
    expect(within(row).getByText('第 1 節')).toBeInTheDocument();
    expect(within(row).getByText(/2026 春シーズン/)).toBeInTheDocument();
    // The heldAt is rendered using the YYYY/MM/DD formatter.
    expect(within(row).getByText('2026/05/08')).toBeInTheDocument();
  });

  it('renders the recent-games feed with match + league context', () => {
    render(<DashboardScreen data={data} />);
    const row = screen.getByTestId('dashboard-recent-game-row-game-1');
    expect(within(row).getByText('第 1 節')).toBeInTheDocument();
    expect(within(row).getByText(/金曜定例会/)).toBeInTheDocument();
    expect(within(row).getByText(/2026 春シーズン/)).toBeInTheDocument();
  });

  it('falls back to "カジュアル対局" for recent games not attached to a match', () => {
    const dataNoMatch: DashboardData = {
      ...emptyData,
      recentGames: [
        {
          id: 'game-x',
          groupId: 'g1',
          groupName: '金曜定例会',
          matchId: null,
          matchName: null,
          leagueId: null,
          leagueName: null,
          playedAt: '2026-05-08T00:00:00.000Z',
        },
      ],
    };

    render(<DashboardScreen data={dataNoMatch} />);
    const row = screen.getByTestId('dashboard-recent-game-row-game-x');
    expect(within(row).getByText('カジュアル対局')).toBeInTheDocument();
  });

  it('renders an empty-state with a CTA for each section when there is no data', () => {
    render(<DashboardScreen data={emptyData} />);
    expect(screen.getByTestId('dashboard-groups-empty')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-leagues-empty')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-matches-empty')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-recent-games-empty')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-invitations-count')).toHaveTextContent('0');
  });
});
