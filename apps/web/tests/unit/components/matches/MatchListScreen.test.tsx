/**
 * Tests for the {@link MatchListScreen} presentational component (Issue #19).
 *
 * The screen is mostly a passthrough — we cover:
 *   - League-scoped header renders the League name and link to its detail.
 *   - Cross-Group header renders the default copy.
 *   - Match rows link to /matches/$matchId.
 *   - Empty state copy differs per scope.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
    params,
    search,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  } & Record<string, unknown>) => {
    const path = params
      ? Object.entries(params).reduce((acc, [k, v]) => acc.replace(`$${k}`, v), to)
      : to;
    const query = search
      ? `?${new URLSearchParams(search as Record<string, string>).toString()}`
      : '';
    return (
      <a href={`${path}${query}`} className={className} {...rest}>
        {children}
      </a>
    );
  },
}));

import { MatchListScreen } from '../../../../src/components/matches/MatchListScreen';

const makeItem = (over: Partial<Parameters<typeof MatchListScreen>[0]['matches'][number]> = {}) => {
  return {
    id: 'm1',
    groupId: 'g1',
    groupName: '金曜定例会',
    leagueId: 'l1',
    leagueName: '2026 春シーズン',
    name: '第 1 節',
    sequenceNumber: 1,
    heldAt: '2026-05-08',
    gameCount: 1,
    lastPlayedAt: '2026-05-08T00:00:00.000Z',
    ...over,
  };
};

describe('MatchListScreen', () => {
  it('renders the League-scoped header and links to /leagues/$leagueId', () => {
    render(
      <MatchListScreen
        matches={[makeItem()]}
        scope={{
          leagueId: 'l1',
          leagueName: '2026 春シーズン',
          groupName: '金曜定例会',
          createSearch: { leagueId: 'l1' },
        }}
        leagueOptions={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2026 春シーズン');
    const detailLink = screen.getByRole('link', { name: 'リーグ詳細' });
    expect(detailLink).toHaveAttribute('href', '/leagues/l1');
    const matchLink = screen.getByTestId('matches-list-item-m1').querySelector('a');
    expect(matchLink).toHaveAttribute('href', '/matches/m1');
  });

  it('renders the cross-Group header when no League is selected', () => {
    render(
      <MatchListScreen
        matches={[makeItem()]}
        scope={{ leagueId: null, leagueName: null, groupName: null, createSearch: {} }}
        leagueOptions={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('マッチ');
    // The card surfaces both group + league name in the meta line under cross-Group scope.
    expect(screen.getByTestId('matches-list-item-m1')).toHaveTextContent('金曜定例会');
    expect(screen.getByTestId('matches-list-item-m1')).toHaveTextContent('2026 春シーズン');
  });

  it('shows the per-scope empty state copy', () => {
    render(
      <MatchListScreen
        matches={[]}
        scope={{
          leagueId: 'l1',
          leagueName: '2026 春シーズン',
          groupName: '金曜定例会',
          createSearch: { leagueId: 'l1' },
        }}
        leagueOptions={[]}
      />,
    );
    expect(screen.getByTestId('matches-empty')).toHaveTextContent(
      'このリーグにはまだマッチがありません',
    );
  });

  it('renders a league selector chip strip with "すべて" + each option (#22)', () => {
    render(
      <MatchListScreen
        matches={[makeItem()]}
        scope={{ leagueId: null, leagueName: null, groupName: null, createSearch: {} }}
        leagueOptions={[
          { id: 'l1', name: '2026 春シーズン', groupName: '金曜定例会' },
          { id: 'l2', name: '2026 夏シーズン', groupName: '土曜定例会' },
        ]}
      />,
    );

    const selector = screen.getByTestId('matches-league-selector');
    expect(selector).toBeInTheDocument();

    const allChip = screen.getByTestId('matches-league-chip-all');
    // Mocked Link emits `?` when `search` is an (empty) object — production
    // strips this. The route path is the assertion that matters here.
    expect(allChip.getAttribute('href')?.replace(/\?$/, '')).toBe('/matches');
    expect(allChip).toHaveAttribute('aria-pressed', 'true');

    const chipL1 = screen.getByTestId('matches-league-chip-l1');
    expect(chipL1).toHaveAttribute('href', '/matches?leagueId=l1');
    expect(chipL1).toHaveAttribute('aria-pressed', 'false');

    const chipL2 = screen.getByTestId('matches-league-chip-l2');
    expect(chipL2).toHaveAttribute('href', '/matches?leagueId=l2');
  });

  it('marks the active chip when filtered to a League (#22)', () => {
    render(
      <MatchListScreen
        matches={[makeItem()]}
        scope={{
          leagueId: 'l1',
          leagueName: '2026 春シーズン',
          groupName: '金曜定例会',
          createSearch: { leagueId: 'l1' },
        }}
        leagueOptions={[
          { id: 'l1', name: '2026 春シーズン', groupName: '金曜定例会' },
          { id: 'l2', name: '2026 夏シーズン', groupName: '土曜定例会' },
        ]}
      />,
    );
    expect(screen.getByTestId('matches-league-chip-all')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('matches-league-chip-l1')).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides the selector entirely when the Owner has no Leagues (#22)', () => {
    render(
      <MatchListScreen
        matches={[]}
        scope={{ leagueId: null, leagueName: null, groupName: null, createSearch: {} }}
        leagueOptions={[]}
      />,
    );
    expect(screen.queryByTestId('matches-league-selector')).toBeNull();
  });

  it('appends the Group name as a sublabel when two leagues share a name (#22)', () => {
    render(
      <MatchListScreen
        matches={[]}
        scope={{ leagueId: null, leagueName: null, groupName: null, createSearch: {} }}
        leagueOptions={[
          { id: 'l1', name: '春シーズン', groupName: '金曜定例会' },
          { id: 'l2', name: '春シーズン', groupName: '土曜定例会' },
        ]}
      />,
    );
    expect(screen.getByTestId('matches-league-chip-l1')).toHaveTextContent('金曜定例会');
    expect(screen.getByTestId('matches-league-chip-l2')).toHaveTextContent('土曜定例会');
  });
});
