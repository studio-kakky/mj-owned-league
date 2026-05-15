import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GroupsScreen } from '../../../../src/components/groups/GroupsScreen';
import type { GroupListItem } from '../../../../src/components/groups/types';

const items: ReadonlyArray<GroupListItem> = [
  {
    id: 'g1',
    name: '金曜定例会',
    playerCount: 6,
    leagueCount: 1,
    lastPlayedAt: '2026-05-08T00:00:00.000Z',
    hasHistory: true,
  },
  {
    id: 'g2',
    name: '会社の同期会',
    playerCount: 4,
    leagueCount: 0,
    lastPlayedAt: null,
    hasHistory: false,
  },
];

const noopHandlers = {
  onCreateGroup: () => {},
  onRenameGroup: () => {},
  onDeleteGroup: () => {},
};

describe('GroupsScreen', () => {
  it('renders an empty-state when there are no groups', () => {
    render(<GroupsScreen groups={[]} {...noopHandlers} />);
    expect(screen.getByTestId('groups-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('groups-list')).not.toBeInTheDocument();
  });

  it('renders one card per group with the metric subtitle', () => {
    render(<GroupsScreen groups={items} {...noopHandlers} />);
    const list = screen.getByTestId('groups-list');
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0] as HTMLElement).getByText('金曜定例会')).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText(/プレイヤー 6 人/)).toBeInTheDocument();
    // Second group has lastPlayedAt = null → "未対局" copy.
    expect(within(cards[1] as HTMLElement).getByText(/未対局/)).toBeInTheDocument();
  });

  describe('create flow', () => {
    it('opens the create modal when the "+" trigger is clicked', () => {
      render(<GroupsScreen groups={items} {...noopHandlers} />);
      expect(screen.queryByTestId('group-create-modal')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('groups-create-trigger'));
      expect(screen.getByTestId('group-create-modal')).toBeInTheDocument();
    });

    it('invokes onCreateGroup with the trimmed name and closes the modal on success', async () => {
      const onCreateGroup = vi.fn().mockResolvedValue(undefined);
      render(
        <GroupsScreen
          groups={items}
          onCreateGroup={onCreateGroup}
          onRenameGroup={() => {}}
          onDeleteGroup={() => {}}
        />,
      );

      fireEvent.click(screen.getByTestId('groups-create-trigger'));
      fireEvent.change(screen.getByTestId('group-form-name-input'), {
        target: { value: '新グループ' },
      });
      fireEvent.submit(screen.getByTestId('group-form-submit').closest('form') as HTMLFormElement);

      await waitFor(() => {
        expect(onCreateGroup).toHaveBeenCalledWith('新グループ');
      });
      await waitFor(() => {
        expect(screen.queryByTestId('group-create-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('edit flow', () => {
    it('seeds the edit modal with the target group name', () => {
      render(<GroupsScreen groups={items} {...noopHandlers} />);
      fireEvent.click(screen.getByTestId('groups-edit-trigger-g1'));

      const editModal = screen.getByTestId('group-edit-modal');
      expect(editModal).toBeInTheDocument();
      expect(within(editModal).getByTestId('group-form-name-input')).toHaveValue('金曜定例会');
    });

    it('invokes onRenameGroup with the target group id', async () => {
      const onRenameGroup = vi.fn().mockResolvedValue(undefined);
      render(
        <GroupsScreen
          groups={items}
          onCreateGroup={() => {}}
          onRenameGroup={onRenameGroup}
          onDeleteGroup={() => {}}
        />,
      );

      fireEvent.click(screen.getByTestId('groups-edit-trigger-g2'));
      fireEvent.change(screen.getByTestId('group-form-name-input'), {
        target: { value: '会社の同期会 2026' },
      });
      fireEvent.submit(screen.getByTestId('group-form-submit').closest('form') as HTMLFormElement);

      await waitFor(() => {
        expect(onRenameGroup).toHaveBeenCalledWith('g2', '会社の同期会 2026');
      });
    });
  });

  describe('delete flow', () => {
    it('opens the delete modal and shows the history notice for history-bearing groups', () => {
      render(<GroupsScreen groups={items} {...noopHandlers} />);
      fireEvent.click(screen.getByTestId('groups-delete-trigger-g1'));

      const modal = screen.getByTestId('group-delete-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByTestId('group-delete-history-notice')).toBeInTheDocument();
      expect(within(modal).getByTestId('group-delete-confirm')).toBeDisabled();
    });

    it('invokes onDeleteGroup for groups without history', async () => {
      const onDeleteGroup = vi.fn().mockResolvedValue(undefined);
      render(
        <GroupsScreen
          groups={items}
          onCreateGroup={() => {}}
          onRenameGroup={() => {}}
          onDeleteGroup={onDeleteGroup}
        />,
      );

      fireEvent.click(screen.getByTestId('groups-delete-trigger-g2'));
      fireEvent.click(screen.getByTestId('group-delete-confirm'));

      await waitFor(() => {
        expect(onDeleteGroup).toHaveBeenCalledWith('g2');
      });
      await waitFor(() => {
        expect(screen.queryByTestId('group-delete-modal')).not.toBeInTheDocument();
      });
    });
  });
});
