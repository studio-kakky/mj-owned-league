import { render, screen } from '@testing-library/react';
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

import { PublicShell } from '../../../src/components/layout/PublicShell';

describe('PublicShell', () => {
  it('renders the JANROKU wordmark and the public-view label', () => {
    render(
      <PublicShell>
        <p>viewer body</p>
      </PublicShell>,
    );
    expect(screen.getByText('JANROKU')).toBeInTheDocument();
    expect(screen.getByText('公開ビュー')).toBeInTheDocument();
  });

  it('renders children inside main', () => {
    render(
      <PublicShell>
        <p data-testid="viewer-body">viewer body</p>
      </PublicShell>,
    );
    expect(screen.getByTestId('viewer-body')).toBeInTheDocument();
  });

  it('does not render an Owner bottom nav or group switcher trigger', () => {
    render(
      <PublicShell>
        <p>viewer body</p>
      </PublicShell>,
    );
    expect(screen.queryByTestId('owner-bottom-nav')).not.toBeInTheDocument();
    expect(screen.queryByTestId('owner-header-group-trigger')).not.toBeInTheDocument();
  });
});
