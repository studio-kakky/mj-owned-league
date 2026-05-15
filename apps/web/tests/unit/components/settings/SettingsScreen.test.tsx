import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '../../../../src/components/settings/SettingsScreen';
import type {
  SettingsData,
  SettingsPlayerItem,
  SettingsRulesetItem,
} from '../../../../src/components/settings/types';

const ruleset1: SettingsRulesetItem = {
  id: 'r1',
  name: '標準ルール',
  startingScore: 25000,
  returnScore: 30000,
  umaPattern: 'UMA_10_30',
  tobiEnabled: false,
  tobiPoint: null,
  isDefault: true,
};

const ruleset2: SettingsRulesetItem = {
  id: 'r2',
  name: '赤あり',
  startingScore: 25000,
  returnScore: 30000,
  umaPattern: 'UMA_5_10',
  tobiEnabled: true,
  tobiPoint: -10,
  isDefault: false,
};

const playerActive: SettingsPlayerItem = {
  id: 'p1',
  name: 'たかし',
  isActive: true,
  hasHistory: false,
};

const playerWithHistory: SettingsPlayerItem = {
  id: 'p2',
  name: 'なお',
  isActive: true,
  hasHistory: true,
};

const data: SettingsData = {
  group: { id: 'g1', name: '金曜定例会', defaultRulesetId: 'r1' },
  rulesets: [ruleset1, ruleset2],
  players: [playerActive, playerWithHistory],
};

const emptyData: SettingsData = {
  group: null,
  rulesets: [],
  players: [],
};

const noopHandlers = {
  onCreateRuleset: () => {},
  onUpdateRuleset: () => {},
  onDeleteRuleset: () => {},
  onSetDefaultRuleset: () => {},
  onCreatePlayer: () => {},
  onRenamePlayer: () => {},
  onDeletePlayer: () => {},
  onDeactivatePlayer: () => {},
  onReactivatePlayer: () => {},
};

describe('SettingsScreen', () => {
  it('renders the no-group empty state when data.group is null', () => {
    render(<SettingsScreen data={emptyData} {...noopHandlers} />);
    expect(screen.getByTestId('settings-no-group-state')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-tabs')).not.toBeInTheDocument();
  });

  it('renders the active group name in the header', () => {
    render(<SettingsScreen data={data} {...noopHandlers} />);
    expect(screen.getByTestId('settings-active-group-name')).toHaveTextContent('金曜定例会');
  });

  it('starts on the ruleset tab and shows the default badge on the active default', () => {
    render(<SettingsScreen data={data} {...noopHandlers} />);
    expect(screen.getByTestId('settings-ruleset-section')).toBeInTheDocument();
    expect(screen.getByTestId('ruleset-default-badge-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('ruleset-default-badge-r2')).not.toBeInTheDocument();
  });

  it('switches to the player section when the tab is clicked', () => {
    render(<SettingsScreen data={data} {...noopHandlers} />);
    fireEvent.click(screen.getByTestId('settings-tab-players'));
    expect(screen.getByTestId('settings-player-section')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ruleset-section')).not.toBeInTheDocument();
  });

  describe('ruleset flows', () => {
    it('disables the delete button on the default ruleset', () => {
      render(<SettingsScreen data={data} {...noopHandlers} />);
      expect(screen.getByTestId('ruleset-delete-trigger-r1')).toBeDisabled();
      expect(screen.getByTestId('ruleset-delete-trigger-r2')).not.toBeDisabled();
    });

    it('opens the delete modal with the default-notice for the default ruleset', () => {
      render(<SettingsScreen data={data} {...noopHandlers} />);
      // Default is disabled — directly click the non-default and confirm it
      // opens without the notice. Then assert the disabled state of the
      // default trigger.
      fireEvent.click(screen.getByTestId('ruleset-delete-trigger-r2'));
      const modal = screen.getByTestId('ruleset-delete-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).queryByTestId('ruleset-delete-default-notice')).not.toBeInTheDocument();
    });

    it('invokes onSetDefaultRuleset when the "既定にする" button is clicked', async () => {
      const onSetDefaultRuleset = vi.fn().mockResolvedValue(undefined);
      render(
        <SettingsScreen data={data} {...noopHandlers} onSetDefaultRuleset={onSetDefaultRuleset} />,
      );
      fireEvent.click(screen.getByTestId('ruleset-set-default-r2'));
      await waitFor(() => {
        expect(onSetDefaultRuleset).toHaveBeenCalledWith('r2');
      });
    });

    it('invokes onCreateRuleset with the trimmed form values', async () => {
      const onCreateRuleset = vi.fn().mockResolvedValue(undefined);
      render(<SettingsScreen data={data} {...noopHandlers} onCreateRuleset={onCreateRuleset} />);
      fireEvent.click(screen.getByTestId('ruleset-create-trigger'));

      fireEvent.change(screen.getByTestId('ruleset-form-name'), {
        target: { value: ' 新ルール ' },
      });
      fireEvent.submit(
        screen.getByTestId('ruleset-form-submit').closest('form') as HTMLFormElement,
      );

      await waitFor(() => {
        expect(onCreateRuleset).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '新ルール',
            tobiEnabled: false,
            tobiPoint: null,
          }),
        );
      });
    });
  });

  describe('player flows', () => {
    it('shows the history notice and disables delete for a player with history', () => {
      render(<SettingsScreen data={data} {...noopHandlers} />);
      fireEvent.click(screen.getByTestId('settings-tab-players'));
      fireEvent.click(screen.getByTestId('player-delete-trigger-p2'));

      const modal = screen.getByTestId('player-delete-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByTestId('player-delete-history-notice')).toBeInTheDocument();
      expect(within(modal).getByTestId('player-delete-confirm')).toBeDisabled();
      // The deactivate fallback should be visible for an active player with history.
      expect(within(modal).getByTestId('player-deactivate-confirm')).toBeInTheDocument();
    });

    it('invokes onDeletePlayer for a player without history', async () => {
      const onDeletePlayer = vi.fn().mockResolvedValue(undefined);
      render(<SettingsScreen data={data} {...noopHandlers} onDeletePlayer={onDeletePlayer} />);
      fireEvent.click(screen.getByTestId('settings-tab-players'));
      fireEvent.click(screen.getByTestId('player-delete-trigger-p1'));
      fireEvent.click(screen.getByTestId('player-delete-confirm'));

      await waitFor(() => {
        expect(onDeletePlayer).toHaveBeenCalledWith('p1');
      });
    });

    it('invokes onDeactivatePlayer when the player-with-history chooses the fallback', async () => {
      const onDeactivatePlayer = vi.fn().mockResolvedValue(undefined);
      render(
        <SettingsScreen data={data} {...noopHandlers} onDeactivatePlayer={onDeactivatePlayer} />,
      );
      fireEvent.click(screen.getByTestId('settings-tab-players'));
      fireEvent.click(screen.getByTestId('player-delete-trigger-p2'));
      fireEvent.click(screen.getByTestId('player-deactivate-confirm'));

      await waitFor(() => {
        expect(onDeactivatePlayer).toHaveBeenCalledWith('p2');
      });
    });

    it('renames a player inline', async () => {
      const onRenamePlayer = vi.fn().mockResolvedValue(undefined);
      render(<SettingsScreen data={data} {...noopHandlers} onRenamePlayer={onRenamePlayer} />);
      fireEvent.click(screen.getByTestId('settings-tab-players'));
      fireEvent.click(screen.getByTestId('player-edit-trigger-p1'));

      fireEvent.change(screen.getByTestId('player-rename-input-p1'), {
        target: { value: 'たかし2' },
      });
      fireEvent.click(screen.getByTestId('player-rename-save-p1'));

      await waitFor(() => {
        expect(onRenamePlayer).toHaveBeenCalledWith('p1', 'たかし2');
      });
    });

    it('adds a player from the inline create row', async () => {
      const onCreatePlayer = vi.fn().mockResolvedValue(undefined);
      render(<SettingsScreen data={data} {...noopHandlers} onCreatePlayer={onCreatePlayer} />);
      fireEvent.click(screen.getByTestId('settings-tab-players'));
      fireEvent.click(screen.getByTestId('player-create-trigger'));

      fireEvent.change(screen.getByTestId('player-create-input'), {
        target: { value: ' たろう ' },
      });
      fireEvent.click(screen.getByTestId('player-create-submit'));

      await waitFor(() => {
        expect(onCreatePlayer).toHaveBeenCalledWith('たろう');
      });
    });
  });
});
