import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicNotFoundView } from '../../../../src/components/public/PublicNotFoundView';

describe('PublicNotFoundView', () => {
  it('renders the generic copy when no description is supplied', () => {
    render(<PublicNotFoundView />);
    expect(screen.getByTestId('public-not-found')).toBeInTheDocument();
    expect(screen.getByText('URL が無効、または公開されていません。')).toBeInTheDocument();
  });

  it('renders a custom description when supplied', () => {
    render(<PublicNotFoundView description="P3 は MVP 未対応" />);
    expect(screen.getByText('P3 は MVP 未対応')).toBeInTheDocument();
  });
});
