import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { LeagueDetailScreen } from '../../../../src/components/leagues/LeagueDetailScreen';
import type { LeagueDetailData } from '../../../../src/components/leagues/types';

const baseDetail: LeagueDetailData = {
  id: 'l1',
  groupId: 'g1',
  groupName: '金曜定例会',
  name: '2026 春シーズン',
  format: '4P_HANCHAN',
  status: 'ACTIVE',
  publicSlug: 'abcdef0123456789',
  defaultRuleset: {
    id: 'r1',
    name: '標準ルール',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30',
    isGroupDefault: true,
  },
  matches: [
    {
      id: 'm1',
      name: '第 1 節',
      sequenceNumber: 1,
      heldAt: '2026-05-08',
      gameCount: 1,
    },
  ],
  recentGames: [
    {
      id: 'game-1',
      matchId: 'm1',
      matchName: '第 1 節',
      playedAt: '2026-05-08T00:00:00.000Z',
    },
  ],
  ranking: [],
};

describe('LeagueDetailScreen', () => {
  it('renders the league name + group label + format chip', () => {
    render(<LeagueDetailScreen data={baseDetail} origin="https://example.com" />);
    expect(screen.getByRole('heading', { name: '2026 春シーズン' })).toBeInTheDocument();
    expect(screen.getByText(/金曜定例会/)).toBeInTheDocument();
    expect(screen.getByText(/4人 半荘/)).toBeInTheDocument();
    expect(screen.getByTestId('league-detail-status')).toHaveTextContent('進行中');
  });

  it('renders the seeded match and recent game', () => {
    render(<LeagueDetailScreen data={baseDetail} origin="https://example.com" />);
    expect(screen.getByTestId('league-detail-match-row-m1')).toBeInTheDocument();
    expect(screen.getByTestId('league-detail-game-row-game-1')).toBeInTheDocument();
  });

  it('renders a "マッチを追加" link pointing at /matches/new with the league id (Issue #20 / #19)', () => {
    render(<LeagueDetailScreen data={baseDetail} origin="https://example.com" />);
    const link = screen.getByTestId('league-detail-match-create-link');
    expect(link).toHaveAttribute('href', '/matches/new');
    // Issue #19 split the section header into a 「一覧」 link + 「追加」
    // CTA so the label collapsed to just 「追加」 — the destination is
    // still S10. The 「一覧」 sibling lives at /matches?leagueId=…
    expect(link).toHaveTextContent('追加');
  });

  it('also renders a "一覧" link to the League-scoped Match list (Issue #19)', () => {
    render(<LeagueDetailScreen data={baseDetail} origin="https://example.com" />);
    const link = screen.getByTestId('league-detail-match-list-link');
    expect(link).toHaveAttribute('href', '/matches');
    expect(link).toHaveTextContent('一覧');
  });

  it('shows the empty-state copy for the ranking section when no rows are present', () => {
    render(<LeagueDetailScreen data={baseDetail} origin="https://example.com" />);
    expect(screen.getByTestId('league-detail-ranking-empty')).toBeInTheDocument();
  });

  describe('public URL copy', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('writes the absolute URL to the clipboard and toggles the button label', async () => {
      // The button schedules a 2000ms `setTimeout` to revert its label. We
      // assert the immediate "コピーしました" state without driving fake
      // timers — combining `vi.useFakeTimers()` with `waitFor` causes the
      // latter to hang because RTL's polling uses the real clock for its
      // interval. The post-revert state is implicitly covered by the
      // `setTimeout` itself; we don't need to verify it here.
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      render(<LeagueDetailScreen data={baseDetail} origin="https://example.com" />);
      const button = screen.getByTestId('league-detail-public-url-copy');
      fireEvent.click(button);

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('https://example.com/l/abcdef0123456789');
      });
      await waitFor(() => {
        expect(button).toHaveTextContent('コピーしました');
      });
    });
  });
});
