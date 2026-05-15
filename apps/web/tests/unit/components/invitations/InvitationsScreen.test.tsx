import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvitationsScreen } from '../../../../src/components/invitations/InvitationsScreen';
import type { InvitationListItem } from '../../../../src/components/invitations/types';

const items: ReadonlyArray<InvitationListItem> = [
  {
    id: 'inv-1',
    memo: '友人の田中さん',
    token: 'tok-1',
    status: 'PENDING',
    createdAt: '2026-05-15T00:00:00.000Z',
    expiresAt: '2026-05-22T00:00:00.000Z',
  },
  {
    id: 'inv-2',
    memo: null,
    token: 'tok-2',
    status: 'CONSUMED',
    createdAt: '2026-05-10T00:00:00.000Z',
    expiresAt: '2026-05-17T00:00:00.000Z',
  },
  {
    id: 'inv-3',
    memo: '昔の同僚',
    token: 'tok-3',
    status: 'EXPIRED',
    createdAt: '2026-04-01T00:00:00.000Z',
    expiresAt: '2026-04-08T00:00:00.000Z',
  },
];

const ORIGIN = 'https://janroku.example.com';

const noopHandlers = {
  onIssue: () => Promise.resolve({ token: 'tok-stub' }),
  onRevoke: () => {},
};

describe('InvitationsScreen', () => {
  it('renders the empty state when there are no invitations', () => {
    render(<InvitationsScreen invitations={[]} origin={ORIGIN} {...noopHandlers} />);
    expect(screen.getByTestId('invitations-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('invitations-list')).not.toBeInTheDocument();
  });

  it('renders one row per invitation with memo and expiry', () => {
    render(<InvitationsScreen invitations={items} origin={ORIGIN} {...noopHandlers} />);
    const list = screen.getByTestId('invitations-list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByText('友人の田中さん')).toBeInTheDocument();
    // memo === null falls back to "(メモなし)".
    expect(within(rows[1] as HTMLElement).getByText('(メモなし)')).toBeInTheDocument();
    // Expiry date is rendered via the YYYY/MM/DD formatter.
    expect(screen.getByTestId('invitations-row-expires-inv-1')).toHaveTextContent('2026/05/22');
  });

  describe('status badges', () => {
    it('renders a PENDING badge for usable invitations', () => {
      render(<InvitationsScreen invitations={items} origin={ORIGIN} {...noopHandlers} />);
      const pendingRow = screen.getByTestId('invitations-list-item-inv-1');
      expect(within(pendingRow).getByTestId('invitations-status-PENDING')).toHaveTextContent(
        '未使用',
      );
    });

    it('renders a CONSUMED badge for already-used invitations', () => {
      render(<InvitationsScreen invitations={items} origin={ORIGIN} {...noopHandlers} />);
      const consumedRow = screen.getByTestId('invitations-list-item-inv-2');
      expect(within(consumedRow).getByTestId('invitations-status-CONSUMED')).toHaveTextContent(
        '使用済み',
      );
    });

    it('renders an EXPIRED badge for expired invitations', () => {
      render(<InvitationsScreen invitations={items} origin={ORIGIN} {...noopHandlers} />);
      const expiredRow = screen.getByTestId('invitations-list-item-inv-3');
      expect(within(expiredRow).getByTestId('invitations-status-EXPIRED')).toHaveTextContent(
        '期限切れ',
      );
    });
  });

  describe('row actions', () => {
    it('shows copy + revoke actions only for PENDING rows', () => {
      render(<InvitationsScreen invitations={items} origin={ORIGIN} {...noopHandlers} />);
      // PENDING row has both actions.
      expect(screen.getByTestId('invitations-copy-inv-1')).toBeInTheDocument();
      expect(screen.getByTestId('invitations-revoke-trigger-inv-1')).toBeInTheDocument();
      // CONSUMED + EXPIRED rows do not.
      expect(screen.queryByTestId('invitations-copy-inv-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('invitations-revoke-trigger-inv-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('invitations-copy-inv-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('invitations-revoke-trigger-inv-3')).not.toBeInTheDocument();
    });

    it('opens the revoke modal when the revoke trigger is clicked', () => {
      render(<InvitationsScreen invitations={items} origin={ORIGIN} {...noopHandlers} />);
      expect(screen.queryByTestId('invitation-revoke-modal')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('invitations-revoke-trigger-inv-1'));
      expect(screen.getByTestId('invitation-revoke-modal')).toBeInTheDocument();
      // Memo is rendered inside the confirmation copy.
      expect(
        within(screen.getByTestId('invitation-revoke-modal')).getByText('友人の田中さん'),
      ).toBeInTheDocument();
    });

    it('invokes onRevoke with the invitation id and closes the modal on success', async () => {
      const onRevoke = vi.fn().mockResolvedValue(undefined);
      render(
        <InvitationsScreen
          invitations={items}
          origin={ORIGIN}
          onIssue={noopHandlers.onIssue}
          onRevoke={onRevoke}
        />,
      );

      fireEvent.click(screen.getByTestId('invitations-revoke-trigger-inv-1'));
      fireEvent.click(screen.getByTestId('invitation-revoke-confirm'));

      await waitFor(() => expect(onRevoke).toHaveBeenCalledWith('inv-1'));
      await waitFor(() =>
        expect(screen.queryByTestId('invitation-revoke-modal')).not.toBeInTheDocument(),
      );
    });
  });

  describe('issue flow', () => {
    it('opens the create modal when the "+" trigger is clicked', () => {
      render(<InvitationsScreen invitations={[]} origin={ORIGIN} {...noopHandlers} />);
      fireEvent.click(screen.getByTestId('invitations-create-trigger'));
      expect(screen.getByTestId('invitation-create-modal')).toBeInTheDocument();
    });

    it('passes the trimmed memo to onIssue and transitions to the created modal with the URL', async () => {
      const onIssue = vi.fn().mockResolvedValue({ token: 'new-token' });
      render(
        <InvitationsScreen
          invitations={[]}
          origin={ORIGIN}
          onIssue={onIssue}
          onRevoke={noopHandlers.onRevoke}
        />,
      );

      fireEvent.click(screen.getByTestId('invitations-create-trigger'));
      // Memo は任意 — 空のまま発行を実行する。
      fireEvent.submit(screen.getByTestId('invitation-form-submit').closest('form') as HTMLElement);

      await waitFor(() => expect(onIssue).toHaveBeenCalledTimes(1));
      // 第一引数は trim 済みの memo。空のままなら ''。
      expect(onIssue).toHaveBeenCalledWith('');

      // The created modal opens with the full URL composed from origin + token.
      await waitFor(() =>
        expect(screen.getByTestId('invitation-created-modal')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('invitation-created-url')).toHaveValue(
        'https://janroku.example.com/invitations/accept/new-token',
      );
    });

    it('forwards the memo input value (trimmed) to onIssue', async () => {
      const onIssue = vi.fn().mockResolvedValue({ token: 'new-token' });
      render(
        <InvitationsScreen
          invitations={[]}
          origin={ORIGIN}
          onIssue={onIssue}
          onRevoke={noopHandlers.onRevoke}
        />,
      );

      fireEvent.click(screen.getByTestId('invitations-create-trigger'));
      fireEvent.change(screen.getByTestId('invitation-form-memo-input'), {
        target: { value: '  田中さん  ' },
      });
      fireEvent.click(screen.getByTestId('invitation-form-submit'));

      await waitFor(() => expect(onIssue).toHaveBeenCalledWith('田中さん'));
    });
  });
});
