import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GroupSwitcherSheet } from '../../../src/components/layout/GroupSwitcherSheet';

describe('GroupSwitcherSheet', () => {
  const baseProps = {
    open: true,
    onClose: () => {},
    onSelect: () => {},
    activeGroupId: null as string | null,
  };

  it('renders nothing when `open` is false', () => {
    const { container } = render(
      <GroupSwitcherSheet {...baseProps} open={false} groups={[{ id: 'g1', name: 'Alpha' }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the disabled empty state when `groups` is null (signed-out)', () => {
    render(<GroupSwitcherSheet {...baseProps} groups={null} />);
    expect(screen.getByTestId('group-switcher-disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('group-switcher-list')).not.toBeInTheDocument();
  });

  it('lists the provided groups and marks the active one with aria-pressed', () => {
    const groups = [
      { id: 'g1', name: 'Tokyo Mahjong' },
      { id: 'g2', name: 'Osaka League' },
    ];
    render(<GroupSwitcherSheet {...baseProps} groups={groups} activeGroupId="g2" />);

    expect(screen.getByText('Tokyo Mahjong')).toBeInTheDocument();
    const osaka = screen.getByRole('button', { name: /Osaka League/ });
    expect(osaka).toHaveAttribute('aria-pressed', 'true');
    const tokyo = screen.getByRole('button', { name: /Tokyo Mahjong/ });
    expect(tokyo).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect and onClose when a group is picked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <GroupSwitcherSheet
        {...baseProps}
        groups={[{ id: 'g1', name: 'Alpha' }]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onSelect).toHaveBeenCalledWith('g1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button or backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<GroupSwitcherSheet {...baseProps} groups={[]} onClose={onClose} />);
    // Both the textual close button and the backdrop carry the "閉じる" name,
    // so we assert there are exactly two and that each triggers onClose.
    const closeAffordances = screen.getAllByRole('button', { name: '閉じる' });
    expect(closeAffordances).toHaveLength(2);
    fireEvent.click(closeAffordances[0] as HTMLElement);
    fireEvent.click(closeAffordances[1] as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<GroupSwitcherSheet {...baseProps} groups={[]} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
