import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GroupFormModal } from '../../../../src/components/groups/GroupFormModal';

describe('GroupFormModal — create', () => {
  it('renders nothing when `open` is false', () => {
    const { container } = render(
      <GroupFormModal open={false} mode="create" onClose={() => {}} onSubmit={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the create title and submit label when mode=create', () => {
    render(<GroupFormModal open mode="create" onClose={() => {}} onSubmit={() => {}} />);
    expect(screen.getByText('グループを作成')).toBeInTheDocument();
    expect(screen.getByTestId('group-form-submit')).toHaveTextContent('作成');
  });

  it('rejects an empty submission and shows the helper error', () => {
    const onSubmit = vi.fn();
    render(<GroupFormModal open mode="create" onClose={() => {}} onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByTestId('group-form-submit').closest('form') as HTMLFormElement);

    expect(screen.getByTestId('group-form-error')).toHaveTextContent(
      'グループ名を入力してください',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes the trimmed name to onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GroupFormModal open mode="create" onClose={() => {}} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('group-form-name-input'), {
      target: { value: '  金曜定例会  ' },
    });
    fireEvent.submit(screen.getByTestId('group-form-submit').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('金曜定例会');
    });
  });
});

describe('GroupFormModal — edit', () => {
  it('seeds the input with `initialName`', () => {
    render(
      <GroupFormModal
        open
        mode="edit"
        initialName="Existing"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('group-form-name-input')).toHaveValue('Existing');
    expect(screen.getByTestId('group-form-submit')).toHaveTextContent('保存');
    expect(screen.getByText('グループを編集')).toBeInTheDocument();
  });
});

describe('GroupFormModal — async submit lifecycle', () => {
  it('surfaces an error and keeps the modal open when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Server exploded'));
    const onClose = vi.fn();
    render(<GroupFormModal open mode="create" onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('group-form-name-input'), {
      target: { value: 'X' },
    });
    fireEvent.submit(screen.getByTestId('group-form-submit').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByTestId('group-form-error')).toHaveTextContent('Server exploded');
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
