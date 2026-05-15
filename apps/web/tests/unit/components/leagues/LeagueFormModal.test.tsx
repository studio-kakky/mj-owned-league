import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LeagueFormModal } from '../../../../src/components/leagues/LeagueFormModal';
import type {
  LeagueGroupOption,
  LeagueRulesetOptionWithGroup,
} from '../../../../src/components/leagues/types';

const groups: LeagueGroupOption[] = [
  { id: 'g1', name: '金曜定例会', defaultRulesetId: 'r1' },
  { id: 'g2', name: '会社の同期会', defaultRulesetId: 'r2' },
];

const rulesets: LeagueRulesetOptionWithGroup[] = [
  {
    id: 'r1',
    name: '標準ルール',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30',
    isGroupDefault: true,
    groupId: 'g1',
  },
  {
    id: 'r2',
    name: '会社デフォルト',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30',
    isGroupDefault: true,
    groupId: 'g2',
  },
];

describe('LeagueFormModal', () => {
  it('renders the form when at least one Group is available', () => {
    render(
      <LeagueFormModal
        open={true}
        groups={groups}
        rulesets={rulesets}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('league-form-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('league-form-format-input')).toBeInTheDocument();
    expect(screen.getByTestId('league-form-group-input')).toBeInTheDocument();
    expect(screen.getByTestId('league-form-ruleset-input')).toBeInTheDocument();
  });

  it('renders the no-groups notice and disables submit when groups is empty', () => {
    render(
      <LeagueFormModal
        open={true}
        groups={[]}
        rulesets={[]}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('league-form-no-groups')).toBeInTheDocument();
    expect(screen.getByTestId('league-form-submit')).toBeDisabled();
  });

  it('rejects empty submissions client-side', async () => {
    const onSubmit = vi.fn();
    render(
      <LeagueFormModal
        open={true}
        groups={groups}
        rulesets={rulesets}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.submit(screen.getByTestId('league-form-submit').closest('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByTestId('league-form-error')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('switches the ruleset dropdown to the new Group default when the Group changes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LeagueFormModal
        open={true}
        groups={groups}
        rulesets={rulesets}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    // Initially the Ruleset select is anchored on g1's default (r1). The
    // double cast (`as unknown as ...`) is the typed escape hatch — RTL's
    // getByTestId returns `HTMLElement`, which doesn't structurally overlap
    // with the more specific element subtypes the tsc compiler insists on.
    const rulesetSelect = screen.getByTestId(
      'league-form-ruleset-input',
    ) as unknown as HTMLSelectElement;
    expect(rulesetSelect.value).toBe('r1');

    // Pick g2 — should swap to r2.
    fireEvent.change(screen.getByTestId('league-form-group-input'), {
      target: { value: 'g2' },
    });
    await waitFor(() => {
      expect(
        (screen.getByTestId('league-form-ruleset-input') as unknown as HTMLSelectElement).value,
      ).toBe('r2');
    });

    // The ruleset options visible in the dropdown should now belong to g2.
    const options = within(screen.getByTestId('league-form-ruleset-input')).queryAllByRole(
      'option',
    ) as unknown as HTMLOptionElement[];
    // First option is "グループの既定を使用"; remaining options should all
    // come from g2.
    const realOptions = options.slice(1);
    expect(realOptions).toHaveLength(1);
    expect(realOptions[0]?.value).toBe('r2');
  });

  it('forwards a validated payload (with defaultRulesetId resolved) on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LeagueFormModal
        open={true}
        groups={groups}
        rulesets={rulesets}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByTestId('league-form-name-input'), {
      target: { value: '  2026 秋シーズン  ' },
    });
    fireEvent.change(screen.getByTestId('league-form-format-input'), {
      target: { value: '3P_HANCHAN' },
    });
    fireEvent.submit(screen.getByTestId('league-form-submit').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        groupId: 'g1',
        name: '2026 秋シーズン',
        format: '3P_HANCHAN',
        defaultRulesetId: 'r1',
      });
    });
  });
});
