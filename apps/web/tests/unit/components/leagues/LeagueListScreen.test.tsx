import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Stub TanStack Router's <Link> so we can render the presentational screen
// without booting a router. Mirrors the trick used in DashboardScreen.test.tsx.
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

import { LeagueListScreen } from '../../../../src/components/leagues/LeagueListScreen';
import type {
  LeagueGroupOption,
  LeagueListItem,
  LeagueRulesetOptionWithGroup,
} from '../../../../src/components/leagues/types';

const baseGroups: LeagueGroupOption[] = [{ id: 'g1', name: '金曜定例会', defaultRulesetId: 'r1' }];

const baseRulesets: LeagueRulesetOptionWithGroup[] = [
  {
    id: 'r1',
    name: '標準ルール',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30',
    isGroupDefault: true,
    groupId: 'g1',
  },
];

const baseLeagues: LeagueListItem[] = [
  {
    id: 'l1',
    groupId: 'g1',
    groupName: '金曜定例会',
    name: '2026 春シーズン',
    format: '4P_HANCHAN',
    status: 'ACTIVE',
    matchCount: 1,
    gameCount: 1,
    playerCount: 4,
    lastPlayedAt: '2026-05-08T00:00:00.000Z',
    publicSlug: 'abcdef0123456789',
  },
];

describe('LeagueListScreen', () => {
  it('renders the filter pills + create trigger', () => {
    render(
      <LeagueListScreen
        groupId="g1"
        leagues={baseLeagues}
        groups={baseGroups}
        rulesets={baseRulesets}
        onCreateLeague={() => {}}
      />,
    );
    expect(screen.getByTestId('leagues-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId('leagues-filter-active')).toBeInTheDocument();
    expect(screen.getByTestId('leagues-filter-ended')).toBeInTheDocument();
    expect(screen.getByTestId('leagues-create-trigger')).toBeEnabled();
  });

  it('renders one card per league (group label removed — the list is group-scoped) linking to the group-scoped detail', () => {
    render(
      <LeagueListScreen
        groupId="g1"
        leagues={baseLeagues}
        groups={baseGroups}
        rulesets={baseRulesets}
        onCreateLeague={() => {}}
      />,
    );
    const list = screen.getByTestId('leagues-list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    const card = items[0] as HTMLElement;
    expect(within(card).getByText('2026 春シーズン')).toBeInTheDocument();
    expect(within(card).getByText(/4人 半荘/)).toBeInTheDocument();
    // The redundant Group label is gone now that the list is scoped to one Group.
    expect(within(card).queryByText('金曜定例会')).not.toBeInTheDocument();
    // The card links to the group-scoped detail route (stubbed Link forwards
    // `params` as an attribute, so we assert on `to`).
    const link = within(card).getByRole('link');
    expect(link).toHaveAttribute('href', '/groups/$groupId/leagues/$leagueId');
  });

  it('filters out leagues whose status mismatches the active pill', () => {
    render(
      <LeagueListScreen
        groupId="g1"
        leagues={baseLeagues}
        groups={baseGroups}
        rulesets={baseRulesets}
        onCreateLeague={() => {}}
      />,
    );
    // Switch to the "終了" filter — MVP has no ended leagues, so the
    // filter-empty state should appear instead of the list.
    fireEvent.click(screen.getByTestId('leagues-filter-ended'));
    expect(screen.queryByTestId('leagues-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('leagues-empty-filtered')).toBeInTheDocument();
  });

  it('shows the "no groups" empty state and disables the trigger when groups are empty', () => {
    render(
      <LeagueListScreen
        groupId="g1"
        leagues={[]}
        groups={[]}
        rulesets={[]}
        onCreateLeague={() => {}}
      />,
    );
    expect(screen.getByTestId('leagues-empty-no-groups')).toBeInTheDocument();
    expect(screen.getByTestId('leagues-create-trigger')).toBeDisabled();
  });

  it('opens the create modal and forwards the payload to onCreateLeague', async () => {
    const onCreateLeague = vi.fn().mockResolvedValue(undefined);
    render(
      <LeagueListScreen
        groupId="g1"
        leagues={baseLeagues}
        groups={baseGroups}
        rulesets={baseRulesets}
        onCreateLeague={onCreateLeague}
      />,
    );

    expect(screen.queryByTestId('league-create-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('leagues-create-trigger'));
    expect(screen.getByTestId('league-create-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('league-form-name-input'), {
      target: { value: '2026 秋シーズン' },
    });
    fireEvent.submit(screen.getByTestId('league-form-submit').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(onCreateLeague).toHaveBeenCalledWith({
        groupId: 'g1',
        name: '2026 秋シーズン',
        format: '4P_HANCHAN',
        defaultRulesetId: 'r1',
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('league-create-modal')).not.toBeInTheDocument();
    });
  });
});
