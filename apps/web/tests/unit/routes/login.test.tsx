/**
 * Unit tests for the S1 ログイン screen (Issue #12).
 *
 * Why we test the component, not the route shell:
 *   `createFileRoute('/login')({ component })` registers the page with
 *   TanStack Router but the rendering body is the plain `LoginPage`
 *   function. Driving the full router up is unnecessary for these
 *   assertions (visual structure + click flow) and would force us to mock
 *   the route tree. Importing the component directly keeps the tests
 *   focused.
 *
 * Why we mock `../auth/client`:
 *   The real client calls into Better Auth which expects a Worker reachable
 *   at `/api/auth/*`. Under vitest+jsdom there is no Worker, so we replace
 *   `signIn.social` with a vi.fn() and assert call shape + state
 *   transitions.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInSocial = vi.fn();

vi.mock('../../../src/auth/client', () => ({
  signIn: {
    social: (args: unknown) => signInSocial(args),
  },
}));

// The login route imports `getSessionServerFn` (for its `beforeLoad` redirect
// of already-authenticated owners). That module imports `cloudflare:workers`,
// which vitest/jsdom cannot resolve — and these tests only exercise the
// component, never `beforeLoad`. Stubbing it keeps the import graph clean.
vi.mock('../../../src/server/session', () => ({
  getSessionServerFn: vi.fn(),
}));

// `createFileRoute` is a registration call with side effects on the
// router. For the component-only tests we don't need it to actually
// register anything — the file already imports the React component we
// care about.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: unknown }) => ({ ...config }),
}));

// Importing after the mocks so they take effect.
import type { ReactElement } from 'react';
import { Route } from '../../../src/routes/login';

// The component is exposed on the route object's `component` field.
// `createFileRoute(...)({ component })` is mocked to return the config
// object as-is, so we can pull the component out here.
const LoginPage = (Route as unknown as { component: () => ReactElement }).component;

describe('LoginPage (S1)', () => {
  beforeEach(() => {
    signInSocial.mockReset();
  });

  it('shows the JANROKU wordmark, tagline and invitation-only notice', () => {
    render(<LoginPage />);

    // The wordmark doubles as the page's single top-level heading.
    expect(screen.getByRole('heading', { name: 'JANROKU' })).toBeInTheDocument();
    expect(screen.getByText(/麻雀リーグの記録アプリ/)).toBeInTheDocument();
    expect(screen.getByText('招待制です。')).toBeInTheDocument();
    expect(screen.getByText(/招待リンクからアカウントを作成してください/)).toBeInTheDocument();
  });

  it('renders the Google sign-in button', () => {
    render(<LoginPage />);
    expect(screen.getByTestId('login-google-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google で続ける/ })).toBeInTheDocument();
  });

  it('renders the terms and privacy links', () => {
    render(<LoginPage />);
    expect(screen.getByTestId('login-terms-link')).toHaveAttribute('href', '/terms');
    expect(screen.getByTestId('login-privacy-link')).toHaveAttribute('href', '/privacy');
  });

  it('invokes signIn.social with provider=google when the button is tapped', () => {
    // Pending promise so the button stays disabled long enough to assert.
    signInSocial.mockReturnValue(new Promise(() => {}));

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId('login-google-button'));

    expect(signInSocial).toHaveBeenCalledTimes(1);
    expect(signInSocial).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/' });
  });

  it('disables the button and shows pending copy while signing in', () => {
    signInSocial.mockReturnValue(new Promise(() => {}));

    render(<LoginPage />);
    const button = screen.getByTestId('login-google-button');
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('サインイン中…');
  });

  it('surfaces an error message when signIn.social rejects', async () => {
    signInSocial.mockRejectedValueOnce(new Error('network down'));

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId('login-google-button'));

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('login-error')).toHaveTextContent('network down');
    // Re-enables the button so the user can retry.
    expect(screen.getByTestId('login-google-button')).not.toBeDisabled();
  });

  it('falls back to a generic message when the thrown value is not an Error', async () => {
    signInSocial.mockRejectedValueOnce('something weird');

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId('login-google-button'));

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('login-error')).toHaveTextContent(
      'サインインを開始できませんでした。時間をおいて再度お試しください。',
    );
  });
});
