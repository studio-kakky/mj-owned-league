import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// We stub TanStack Router's <Link> so we don't have to spin up a full router
// for these layout tests. The shells under test rely on Link only for
// navigation rendering; behavior (group sheet, disabled trigger, nav items)
// is independent of routing internals.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
    activeProps: _activeProps,
    activeOptions: _activeOptions,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    activeProps?: unknown;
    activeOptions?: unknown;
  } & Record<string, unknown>) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
}));

import { OwnerShell } from '../../../src/components/layout/OwnerShell';
import type { GroupSummary, OwnerSession } from '../../../src/components/layout/types';

const session: OwnerSession = { ownerId: 'o1', displayName: 'Tester' };
const groups: ReadonlyArray<GroupSummary> = [
  { id: 'g1', name: 'Alpha League' },
  { id: 'g2', name: 'Beta Club' },
];

describe('OwnerShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four bottom-nav items', () => {
    render(
      <OwnerShell session={session} activeGroup={null} groups={groups} onSelectGroup={() => {}}>
        <p>page body</p>
      </OwnerShell>,
    );

    const nav = screen.getByTestId('owner-bottom-nav');
    expect(nav).toBeInTheDocument();
    for (const label of ['ホーム', 'リーグ', 'マッチ', '設定']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('disables the group-switcher trigger when signed out', () => {
    render(
      <OwnerShell session={null} activeGroup={null} groups={null} onSelectGroup={() => {}}>
        <p>page body</p>
      </OwnerShell>,
    );

    const trigger = screen.getByTestId('owner-header-group-trigger');
    expect(trigger).toBeDisabled();
  });

  it('opens the sheet and switches the active group', () => {
    const onSelectGroup = vi.fn();
    render(
      <OwnerShell
        session={session}
        activeGroup={groups[0] ?? null}
        groups={groups}
        onSelectGroup={onSelectGroup}
      >
        <p>page body</p>
      </OwnerShell>,
    );

    // Sheet is closed initially.
    expect(screen.queryByTestId('group-switcher-sheet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('owner-header-group-trigger'));
    expect(screen.getByTestId('group-switcher-sheet')).toBeInTheDocument();

    // Pick the second group.
    fireEvent.click(screen.getByRole('button', { name: /Beta Club/ }));
    expect(onSelectGroup).toHaveBeenCalledWith('g2');

    // Sheet closes after selection.
    expect(screen.queryByTestId('group-switcher-sheet')).not.toBeInTheDocument();
  });

  it('renders the current active group name in the header trigger', () => {
    render(
      <OwnerShell
        session={session}
        activeGroup={groups[1] ?? null}
        groups={groups}
        onSelectGroup={() => {}}
      >
        <p>page body</p>
      </OwnerShell>,
    );

    expect(screen.getByTestId('owner-header-group-trigger')).toHaveTextContent('Beta Club');
  });

  it('falls back to "グループ未選択" when authenticated but no group is active', () => {
    render(
      <OwnerShell session={session} activeGroup={null} groups={groups} onSelectGroup={() => {}}>
        <p>page body</p>
      </OwnerShell>,
    );

    expect(screen.getByTestId('owner-header-group-trigger')).toHaveTextContent('グループ未選択');
  });

  it('renders children inside the main region', () => {
    render(
      <OwnerShell session={session} activeGroup={null} groups={groups} onSelectGroup={() => {}}>
        <p data-testid="page-body">page body</p>
      </OwnerShell>,
    );
    expect(screen.getByTestId('page-body')).toBeInTheDocument();
  });
});
