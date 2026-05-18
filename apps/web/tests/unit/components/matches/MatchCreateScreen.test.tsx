/**
 * Tests for the {@link MatchCreateScreen} presentational component
 * (`04-screens.md` § S10, Issue #20).
 *
 * Pattern matches `LeagueListScreen.test.tsx`: stub `<Link>` so the page
 * renders without a router context, then exercise the user-visible
 * behaviour (form contract, format-locking, participant-pool warning,
 * empty state).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

import { MatchCreateScreen } from '../../../../src/components/matches/MatchCreateScreen';
import type { MatchCreateContext } from '../../../../src/components/matches/types';

const makeContext = (overrides: Partial<MatchCreateContext> = {}): MatchCreateContext => {
  return {
    groups: [
      { id: 'g1', name: '金曜定例会', defaultRulesetId: 'r1' },
      { id: 'g2', name: '会社の同期会', defaultRulesetId: 'r2' },
    ],
    leagues: [
      {
        id: 'l1',
        groupId: 'g1',
        name: '2026 春シーズン',
        format: '4P_HANCHAN',
        defaultRulesetId: 'r1',
      },
    ],
    rulesets: [
      {
        id: 'r1',
        groupId: 'g1',
        name: '標準ルール',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        isGroupDefault: true,
      },
      {
        id: 'r2',
        groupId: 'g2',
        name: '会社デフォルト',
        startingScore: 25000,
        returnScore: 30000,
        umaPattern: 'UMA_10_30',
        isGroupDefault: true,
      },
    ],
    activePlayerCountByGroup: { g1: 4, g2: 0 },
    initialLeagueId: null,
    initialGroupId: 'g1',
    initialSequenceNumber: null,
    ...overrides,
  };
};

describe('MatchCreateScreen', () => {
  it('renders the form when at least one Group is available', () => {
    render(<MatchCreateScreen data={makeContext()} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByTestId('match-form-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('match-form-group-input')).toBeInTheDocument();
    expect(screen.getByTestId('match-form-league-input')).toBeInTheDocument();
    expect(screen.getByTestId('match-form-format-input')).toBeInTheDocument();
  });

  it('renders the no-groups empty state when groups is empty', () => {
    render(
      <MatchCreateScreen
        data={makeContext({ groups: [], leagues: [], rulesets: [], initialGroupId: null })}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('match-create-empty-no-groups')).toBeInTheDocument();
    expect(screen.queryByTestId('match-form-name-input')).not.toBeInTheDocument();
  });

  it('locks the Group and League selectors when initialLeagueId is set', () => {
    render(
      <MatchCreateScreen
        data={makeContext({
          initialLeagueId: 'l1',
          initialGroupId: 'g1',
          initialSequenceNumber: 3,
        })}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('match-form-group-input')).toBeDisabled();
    expect(screen.getByTestId('match-form-league-input')).toBeDisabled();
    // Sequence number preview is surfaced inline.
    expect(screen.getByTestId('match-form-sequence-number')).toHaveTextContent('第 3 節');
    // Format is also locked, matching the League's format.
    expect(screen.getByTestId('match-form-format-input')).toBeDisabled();
  });

  it('blocks submission and surfaces a warning when a 3-player format meets a pool below three', async () => {
    const onSubmit = vi.fn();
    render(
      <MatchCreateScreen
        data={makeContext({
          activePlayerCountByGroup: { g1: 2, g2: 0 },
        })}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    // Switch the standalone format selector to 3P (no league is selected).
    fireEvent.change(screen.getByTestId('match-form-format-input'), {
      target: { value: '3P_HANCHAN' },
    });
    expect(screen.getByTestId('match-form-pool-warning')).toBeInTheDocument();
    expect(screen.getByTestId('match-form-submit')).toBeDisabled();

    // Even if we try to coax the form into submitting (e.g. without clicking
    // the disabled button), the handler still rejects via the inline guard.
    fireEvent.change(screen.getByTestId('match-form-name-input'), {
      target: { value: 'Forced' },
    });
    fireEvent.submit(screen.getByTestId('match-form-submit').closest('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByTestId('match-form-error')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('forwards the trimmed payload (with normalised optional fields) on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchCreateScreen data={makeContext()} onSubmit={onSubmit} onCancel={() => {}} />);

    fireEvent.change(screen.getByTestId('match-form-name-input'), {
      target: { value: '  第 2 節  ' },
    });
    fireEvent.change(screen.getByTestId('match-form-helddate-input'), {
      target: { value: '2026-05-15' },
    });
    fireEvent.change(screen.getByTestId('match-form-memo-input'), {
      target: { value: '  ' },
    });
    fireEvent.submit(screen.getByTestId('match-form-submit').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        groupId: 'g1',
        leagueId: null,
        name: '第 2 節',
        heldAt: '2026-05-15',
        memo: null,
        defaultRulesetId: null,
      });
    });
  });

  it('resets the League / Ruleset selectors when the Group changes (cross-Group flow)', async () => {
    render(<MatchCreateScreen data={makeContext()} onSubmit={() => {}} onCancel={() => {}} />);

    // Initially the league dropdown shows g1's league.
    const leagueSelect = screen.getByTestId(
      'match-form-league-input',
    ) as unknown as HTMLSelectElement;
    expect(leagueSelect.value).toBe('__no_league__');

    // Pick g2 — the league select stays on "no league", but the available
    // league options should no longer include g1's league.
    fireEvent.change(screen.getByTestId('match-form-group-input'), {
      target: { value: 'g2' },
    });
    await waitFor(() => {
      const next = screen.getByTestId('match-form-league-input') as unknown as HTMLSelectElement;
      expect(next.value).toBe('__no_league__');
      // The hidden options should now only contain the "no league" sentinel.
      const options = Array.from(next.options).map((o) => o.value);
      expect(options).toEqual(['__no_league__']);
    });
  });
});
