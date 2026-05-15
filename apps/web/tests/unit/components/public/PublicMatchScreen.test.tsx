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

import { PublicMatchScreen } from '../../../../src/components/public/PublicMatchScreen';
import type { PublicMatchData } from '../../../../src/components/public/types';

const baseData: PublicMatchData = {
  name: '第 1 節',
  heldAt: '2026-05-08',
  memo: 'みんなで集まろう',
  format: '4P_HANCHAN',
  groupName: '金曜定例会',
  leagueName: '2026 春シーズン',
  leaguePublicSlug: 'slug-abc',
  sequenceNumber: 1,
  defaultRuleset: {
    name: '標準ルール',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30',
    tobiPoint: null,
  },
  ranking: [
    {
      playerId: 'p1',
      playerName: 'たかし',
      gameCount: 1,
      totalPoints: 65,
      averagePoints: 65,
      topCount: 1,
      lastCount: 0,
    },
  ],
  games: [
    {
      id: 'g1',
      playedAt: '2026-05-08T00:00:00.000Z',
      rulesetName: '標準ルール',
      results: [
        {
          playerId: 'p1',
          playerName: 'たかし',
          rawScore: 45000,
          points: 65,
          rank: 1,
          tobiRole: null,
        },
        {
          playerId: 'p2',
          playerName: 'なお',
          rawScore: 32000,
          points: 12,
          rank: 2,
          tobiRole: null,
        },
        {
          playerId: 'p3',
          playerName: 'ゆうき',
          rawScore: 18000,
          points: -22,
          rank: 3,
          tobiRole: null,
        },
        {
          playerId: 'p4',
          playerName: 'みき',
          rawScore: 5000,
          points: -55,
          rank: 4,
          tobiRole: 'VICTIM',
        },
      ],
    },
  ],
};

describe('PublicMatchScreen', () => {
  it('renders header, ranking, and game list', () => {
    render(<PublicMatchScreen data={baseData} />);
    expect(screen.getByTestId('public-match-screen')).toBeInTheDocument();
    expect(screen.getByText('第 1 節 第 1 節')).toBeInTheDocument();
    expect(screen.getByTestId('public-match-ranking-row-p1')).toBeInTheDocument();
    expect(screen.getByTestId('public-match-game-row-g1')).toBeInTheDocument();
  });

  it('links the parent League name back to the League public page', () => {
    render(<PublicMatchScreen data={baseData} />);
    const anchors = screen.getAllByRole('link');
    const leagueLink = anchors.find((a) => a.getAttribute('href') === '/l/slug-abc');
    expect(leagueLink).toBeDefined();
    expect(leagueLink?.textContent).toBe('2026 春シーズン');
  });

  it('shows the tobi badge on a result with a tobiRole', () => {
    render(<PublicMatchScreen data={baseData} />);
    expect(screen.getByText('飛んだ')).toBeInTheDocument();
  });

  it('renders the memo when present', () => {
    render(<PublicMatchScreen data={baseData} />);
    expect(screen.getByText('みんなで集まろう')).toBeInTheDocument();
  });

  it('omits the memo block when memo is null', () => {
    render(<PublicMatchScreen data={{ ...baseData, memo: null }} />);
    expect(screen.queryByText('みんなで集まろう')).toBeNull();
  });
});
