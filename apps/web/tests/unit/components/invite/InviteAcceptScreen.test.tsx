/**
 * Unit tests for the S2 招待受け入れ screen (Issue #13).
 *
 * Why the component (not the route) is under test:
 *   `routes/invitations.accept.$token.tsx` is a thin wiring layer — its
 *   responsibility is "call verifyInvitationServerFn / signIn.social". The
 *   screen is the surface that branches on `valid` / `invalid` and renders
 *   the user-visible affordances. Driving the route would require booting
 *   the router and mocking the auth client, which adds noise without
 *   improving coverage.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InviteAcceptVerifyResult } from '../../../../src/components/invite/InviteAcceptScreen';
import { InviteAcceptScreen } from '../../../../src/components/invite/InviteAcceptScreen';

const validVerification: InviteAcceptVerifyResult = {
  kind: 'valid',
  memo: '友人の田中さん',
  expiresAt: '2026-05-22T00:00:00.000Z',
  issuerEmail: 'owner@example.com',
};

describe('InviteAcceptScreen — valid invitation', () => {
  it('renders the JANROKU wordmark and accept heading', () => {
    render(<InviteAcceptScreen verification={validVerification} onAccept={vi.fn()} />);

    expect(screen.getByText('JANROKU')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '招待を受け入れる' })).toBeInTheDocument();
  });

  it('shows the issuer email, memo, and expiry date', () => {
    render(<InviteAcceptScreen verification={validVerification} onAccept={vi.fn()} />);

    expect(screen.getByTestId('invite-accept-issuer-email')).toHaveTextContent('owner@example.com');
    expect(screen.getByTestId('invite-accept-memo')).toHaveTextContent('メモ: 友人の田中さん');
    // formatDate -> YYYY/MM/DD; 2026-05-22 in local time.
    const expires = screen.getByTestId('invite-accept-expires');
    expect(expires.textContent).toMatch(/2026\/\d{2}\/\d{2}/);
  });

  it('omits the memo row when the memo is null', () => {
    render(
      <InviteAcceptScreen verification={{ ...validVerification, memo: null }} onAccept={vi.fn()} />,
    );
    expect(screen.queryByTestId('invite-accept-memo')).not.toBeInTheDocument();
  });

  it('falls back to a placeholder string when the issuer email is empty', () => {
    render(
      <InviteAcceptScreen
        verification={{ ...validVerification, issuerEmail: '' }}
        onAccept={vi.fn()}
      />,
    );
    expect(screen.getByTestId('invite-accept-issuer-email')).toHaveTextContent('(発行者情報なし)');
  });

  it('invokes onAccept when the Google button is tapped', () => {
    const onAccept = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<InviteAcceptScreen verification={validVerification} onAccept={onAccept} />);

    fireEvent.click(screen.getByTestId('invite-accept-google-button'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('disables the button and shows pending copy while the accept callback is in flight', () => {
    // Pending promise so the disabled state stays observable.
    const onAccept = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<InviteAcceptScreen verification={validVerification} onAccept={onAccept} />);

    const button = screen.getByTestId('invite-accept-google-button');
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('承諾処理中…');
  });

  it('surfaces an error and re-enables the button when onAccept rejects', async () => {
    const onAccept = vi.fn().mockRejectedValueOnce(new Error('network down'));
    render(<InviteAcceptScreen verification={validVerification} onAccept={onAccept} />);

    fireEvent.click(screen.getByTestId('invite-accept-google-button'));

    await waitFor(() => {
      expect(screen.getByTestId('invite-accept-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('invite-accept-error')).toHaveTextContent('network down');
    expect(screen.getByTestId('invite-accept-google-button')).not.toBeDisabled();
  });

  it('falls back to a generic error message when the rejected value is not an Error', async () => {
    const onAccept = vi.fn().mockRejectedValueOnce('boom');
    render(<InviteAcceptScreen verification={validVerification} onAccept={onAccept} />);

    fireEvent.click(screen.getByTestId('invite-accept-google-button'));

    await waitFor(() => {
      expect(screen.getByTestId('invite-accept-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('invite-accept-error')).toHaveTextContent(
      '招待の受け入れを開始できませんでした。時間をおいて再度お試しください。',
    );
  });
});

describe('InviteAcceptScreen — invalid invitation', () => {
  it.each([
    ['NOT_FOUND', '招待が見つかりません'],
    ['EXPIRED', '招待の有効期限が切れています'],
    ['CONSUMED', 'この招待は既に使用されています'],
    ['REVOKED', 'この招待は取り消されています'],
  ] as const)('renders the %s error card with the matching title', (reason, title) => {
    render(<InviteAcceptScreen verification={{ kind: 'invalid', reason }} onAccept={vi.fn()} />);
    expect(screen.getByTestId(`invite-accept-invalid-${reason}`)).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    // The Google button must not render for invalid tokens — the criterion
    // "有効なトークンのみアカウント作成可能" forbids it.
    expect(screen.queryByTestId('invite-accept-google-button')).not.toBeInTheDocument();
  });

  it('renders a sign-in link for existing Owners', () => {
    render(
      <InviteAcceptScreen
        verification={{ kind: 'invalid', reason: 'EXPIRED' }}
        onAccept={vi.fn()}
      />,
    );
    expect(screen.getByTestId('invite-accept-login-link')).toHaveAttribute('href', '/login');
  });
});
