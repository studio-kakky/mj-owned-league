import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GroupDeleteConfirmModal } from '../../../../src/components/groups/GroupDeleteConfirmModal';

describe('GroupDeleteConfirmModal', () => {
  it('renders nothing when `open` is false', () => {
    const { container } = render(
      <GroupDeleteConfirmModal
        open={false}
        groupName="x"
        hasHistory={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the group name in the dialog body', () => {
    render(
      <GroupDeleteConfirmModal
        open
        groupName="金曜定例会"
        hasHistory={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText('金曜定例会')).toBeInTheDocument();
  });

  it('calls onConfirm when there is no history and the confirm button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupDeleteConfirmModal
        open
        groupName="g"
        hasHistory={false}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId('group-delete-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables the confirm button and shows the history notice when hasHistory=true', () => {
    const onConfirm = vi.fn();
    render(
      <GroupDeleteConfirmModal
        open
        groupName="g"
        hasHistory
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId('group-delete-history-notice')).toBeInTheDocument();
    expect(screen.getByTestId('group-delete-confirm')).toBeDisabled();

    fireEvent.click(screen.getByTestId('group-delete-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('surfaces an error when onConfirm rejects and keeps the modal open', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));
    const onClose = vi.fn();
    render(
      <GroupDeleteConfirmModal
        open
        groupName="g"
        hasHistory={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId('group-delete-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('group-delete-error')).toHaveTextContent('boom');
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
