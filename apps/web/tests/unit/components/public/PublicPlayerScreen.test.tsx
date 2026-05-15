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

import { PublicPlayerScreen } from '../../../../src/components/public/PublicPlayerScreen';
import type { PublicPlayerData } from '../../../../src/components/public/types';

const baseData: PublicPlayerData = {
  playerId: 'p1',
  playerName: 'たかし',
  leagueName: '2026 春シーズン',
  leaguePublicSlug: 'slug-abc',
  format: '4P_HANCHAN',
  summary: {
    gameCount: 3,
    totalPoints: 90,
    averagePoints: 30,
    topCount: 2,
    lastCount: 0,
    topRate: 2 / 3,
    averageRank: 1.5,
  },
  matches: [
    {
      matchId: 'm1',
      matchName: '第 1 節',
      sequenceNumber: 1,
      heldAt: '2026-05-08',
      gameCount: 2,
      totalPoints: 70,
      averagePoints: 35,
      topCount: 2,
      lastCount: 0,
    },
  ],
  games: [
    {
      gameId: 'g1',
      matchId: 'm1',
      matchName: '第 1 節',
      matchSequenceNumber: 1,
      playedAt: '2026-05-08T00:00:00.000Z',
      rawScore: 45000,
      points: 65,
      rank: 1,
      tobiRole: null,
    },
  ],
};

describe('PublicPlayerScreen', () => {
  it('renders header, summary, Match breakdown, and game history', () => {
    render(<PublicPlayerScreen data={baseData} />);
    expect(screen.getByTestId('public-player-screen')).toBeInTheDocument();
    expect(screen.getByText('たかし')).toBeInTheDocument();
    expect(screen.getByTestId('public-player-summary-section')).toBeInTheDocument();
    expect(screen.getByTestId('public-player-match-row-m1')).toBeInTheDocument();
    expect(screen.getByTestId('public-player-game-row-g1')).toBeInTheDocument();
  });

  it('links the parent League name back to the League public page', () => {
    render(<PublicPlayerScreen data={baseData} />);
    const anchors = screen.getAllByRole('link');
    const leagueLink = anchors.find((a) => a.getAttribute('href') === '/l/slug-abc');
    expect(leagueLink?.textContent).toBe('2026 春シーズン');
  });

  it('links each Match row to the corresponding public Match page', () => {
    render(<PublicPlayerScreen data={baseData} />);
    const anchors = screen.getAllByRole('link');
    const matchLink = anchors.find((a) => a.getAttribute('href') === '/l/slug-abc/matches/1');
    expect(matchLink).toBeDefined();
  });

  it('renders an empty state when the Match list is empty', () => {
    render(<PublicPlayerScreen data={{ ...baseData, matches: [] }} />);
    expect(screen.getByTestId('public-player-matches-empty')).toBeInTheDocument();
  });

  it('renders an empty state when the player has no games yet', () => {
    render(<PublicPlayerScreen data={{ ...baseData, games: [] }} />);
    expect(screen.getByTestId('public-player-games-empty')).toBeInTheDocument();
  });
});
