import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    className,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
    className?: string;
  } & Record<string, unknown>) => {
    const href = Object.entries(params ?? {}).reduce(
      (acc, [k, v]) => acc.replace(`$${k}`, String(v)),
      to,
    );
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
}));

import { PublicLeagueScreen } from '../../../../src/components/public/PublicLeagueScreen';
import type { PublicLeagueData } from '../../../../src/components/public/types';

const baseData: PublicLeagueData = {
  publicSlug: 'slug-abc',
  name: '2026 春シーズン',
  format: '4P_HANCHAN',
  groupName: '金曜定例会',
  defaultRuleset: {
    name: '標準ルール',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30',
    tobiPoint: null,
  },
  matches: [
    {
      id: 'm1',
      name: '第 1 節',
      sequenceNumber: 1,
      heldAt: '2026-05-08',
      gameCount: 3,
    },
  ],
  ranking: [
    {
      playerId: 'p1',
      playerName: 'たかし',
      gameCount: 1,
      totalPoints: 65,
      averagePoints: 65,
      topCount: 1,
      lastCount: 0,
      averageRank: 1,
      topRate: 1,
    },
    {
      playerId: 'p2',
      playerName: 'なお',
      gameCount: 1,
      totalPoints: 12,
      averagePoints: 12,
      topCount: 0,
      lastCount: 0,
      averageRank: 2,
      topRate: 0,
    },
  ],
};

describe('PublicLeagueScreen', () => {
  it('renders the header, ranking, and Match list', () => {
    render(<PublicLeagueScreen data={baseData} />);
    expect(screen.getByTestId('public-league-screen')).toBeInTheDocument();
    expect(screen.getByText('2026 春シーズン')).toBeInTheDocument();
    expect(screen.getByText('金曜定例会 / 4人 半荘')).toBeInTheDocument();
    expect(screen.getByTestId('public-league-ranking-row-p1')).toBeInTheDocument();
    expect(screen.getByTestId('public-league-match-row-m1')).toBeInTheDocument();
  });

  it('links each ranking row to the per-player public page', () => {
    render(<PublicLeagueScreen data={baseData} />);
    const link = screen.getByTestId('public-league-ranking-player-link-p1') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/l/slug-abc/players/p1');
  });

  it('links each Match row to the per-Match public page', () => {
    render(<PublicLeagueScreen data={baseData} />);
    const anchors = screen.getAllByRole('link');
    const matchLink = anchors.find((a) => a.getAttribute('href') === '/l/slug-abc/matches/1');
    expect(matchLink).toBeDefined();
  });

  it('renders an empty ranking state when there are no rows', () => {
    render(<PublicLeagueScreen data={{ ...baseData, ranking: [] }} />);
    expect(screen.getByTestId('public-league-ranking-empty')).toBeInTheDocument();
  });

  it('renders an empty Match state when there are no Matches', () => {
    render(<PublicLeagueScreen data={{ ...baseData, matches: [] }} />);
    expect(screen.getByTestId('public-league-matches-empty')).toBeInTheDocument();
  });

  it('shows the not-set ruleset callout when defaultRuleset is null', () => {
    render(<PublicLeagueScreen data={{ ...baseData, defaultRuleset: null }} />);
    expect(screen.getByTestId('public-league-ruleset-empty')).toBeInTheDocument();
  });
});
