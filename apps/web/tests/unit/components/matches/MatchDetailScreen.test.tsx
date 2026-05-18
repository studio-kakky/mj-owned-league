/**
 * Tests for the {@link MatchDetailScreen} presentational component (Issue #19).
 *
 * Same pattern as `MatchCreateScreen.test.tsx`: stub `<Link>` so the page
 * renders without a router context, then exercise the user-visible behaviour:
 *   - 順位表 / 対局リストが描画される
 *   - 「対局を追加」CTA でモーダルが開く
 *   - 合計不一致 / 同点を保存ブロックする
 *   - 削除確認モーダルが onConfirm を呼ぶ
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import type { MatchDetailData } from '../../../../src/components/matches/detail-types';
import { MatchDetailScreen } from '../../../../src/components/matches/MatchDetailScreen';

const makeDetail = (overrides: Partial<MatchDetailData> = {}): MatchDetailData => {
  const rulesetOption = {
    id: 'r1',
    name: '標準ルール',
    startingScore: 25000,
    returnScore: 30000,
    umaPattern: 'UMA_10_30' as const,
    tobiEnabled: false,
    tobiPoint: null,
    isMatchDefault: true,
    isGroupDefault: true,
  };
  return {
    id: 'm1',
    groupId: 'g1',
    groupName: '金曜定例会',
    leagueId: 'l1',
    leagueName: '2026 春シーズン',
    leaguePublicSlug: 'spring-2026',
    sequenceNumber: 1,
    name: '第 1 節',
    heldAt: '2026-05-08',
    memo: null,
    format: '4P_HANCHAN',
    defaultRuleset: rulesetOption,
    availableRulesets: [rulesetOption],
    availablePlayers: [
      { id: 'p1', name: 'たかし', isActive: true },
      { id: 'p2', name: 'なお', isActive: true },
      { id: 'p3', name: 'ゆうき', isActive: true },
      { id: 'p4', name: 'みき', isActive: true },
    ],
    ranking: [
      {
        playerId: 'p1',
        playerName: 'たかし',
        gameCount: 1,
        totalPoints: 65,
        averagePoints: 65,
        topCount: 1,
        lastCount: 0,
      },
      {
        playerId: 'p2',
        playerName: 'なお',
        gameCount: 1,
        totalPoints: 12,
        averagePoints: 12,
        topCount: 0,
        lastCount: 0,
      },
      {
        playerId: 'p3',
        playerName: 'ゆうき',
        gameCount: 1,
        totalPoints: -22,
        averagePoints: -22,
        topCount: 0,
        lastCount: 0,
      },
      {
        playerId: 'p4',
        playerName: 'みき',
        gameCount: 1,
        totalPoints: -55,
        averagePoints: -55,
        topCount: 0,
        lastCount: 1,
      },
    ],
    games: [
      {
        id: 'game-1',
        playedAt: '2026-05-08T00:00:00.000Z',
        rulesetId: 'r1',
        rulesetName: '標準ルール',
        results: [
          {
            playerId: 'p1',
            playerName: 'たかし',
            rawScore: 45000,
            points: 65,
            rank: 1,
            tobiRole: null,
          },
          {
            playerId: 'p2',
            playerName: 'なお',
            rawScore: 32000,
            points: 12,
            rank: 2,
            tobiRole: null,
          },
          {
            playerId: 'p3',
            playerName: 'ゆうき',
            rawScore: 18000,
            points: -22,
            rank: 3,
            tobiRole: null,
          },
          {
            playerId: 'p4',
            playerName: 'みき',
            rawScore: 5000,
            points: -55,
            rank: 4,
            tobiRole: null,
          },
        ],
      },
    ],
    ...overrides,
  };
};

describe('MatchDetailScreen', () => {
  it('renders the header with sequenceNumber + name, ranking, and game list', () => {
    render(
      <MatchDetailScreen
        data={makeDetail()}
        onSubmitGame={vi.fn()}
        onDeleteGame={vi.fn()}
        origin="https://example.com"
      />,
    );
    expect(screen.getByText('第 1 節 第 1 節')).toBeInTheDocument();
    // ranking row for たかし present and shows topCount=1.
    expect(screen.getByTestId('match-detail-ranking-row-p1')).toHaveTextContent('たかし');
    expect(screen.getByTestId('match-detail-game-row-game-1')).toBeInTheDocument();
  });

  it('renders the public URL when the Match belongs to a League and copies it on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <MatchDetailScreen
        data={makeDetail()}
        onSubmitGame={vi.fn()}
        onDeleteGame={vi.fn()}
        origin="https://example.com"
      />,
    );
    const copyBtn = screen.getByTestId('match-detail-public-url-copy');
    fireEvent.click(copyBtn);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://example.com/l/spring-2026/matches/1'),
    );
  });

  it('opens the add-game modal when the CTA is clicked and rejects mismatched score sums', async () => {
    const onSubmitGame = vi.fn();
    render(
      <MatchDetailScreen
        data={makeDetail()}
        onSubmitGame={onSubmitGame}
        onDeleteGame={vi.fn()}
        origin="https://example.com"
      />,
    );
    fireEvent.click(screen.getByTestId('match-detail-add-game'));
    expect(screen.getByTestId('game-form-modal')).toBeInTheDocument();

    // Fill all 4 player slots with valid players but a sum that doesn't match.
    fireEvent.change(screen.getByTestId('game-form-player-input-0'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-1'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-2'), { target: { value: 'p3' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-3'), { target: { value: 'p4' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-0'), { target: { value: '50000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-1'), { target: { value: '30000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-2'), { target: { value: '15000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-3'), { target: { value: '10000' } }); // sums to 105k

    fireEvent.click(screen.getByTestId('game-form-submit'));
    expect(await screen.findByTestId('game-form-error')).toHaveTextContent('一致しません');
    expect(onSubmitGame).not.toHaveBeenCalled();
  });

  it('rejects tied raw scores per the issue acceptance criterion', async () => {
    const onSubmitGame = vi.fn();
    render(
      <MatchDetailScreen
        data={makeDetail()}
        onSubmitGame={onSubmitGame}
        onDeleteGame={vi.fn()}
        origin="https://example.com"
      />,
    );
    fireEvent.click(screen.getByTestId('match-detail-add-game'));

    fireEvent.change(screen.getByTestId('game-form-player-input-0'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-1'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-2'), { target: { value: 'p3' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-3'), { target: { value: 'p4' } });
    // tied — two 25000s.
    fireEvent.change(screen.getByTestId('game-form-score-input-0'), { target: { value: '25000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-1'), { target: { value: '25000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-2'), { target: { value: '30000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-3'), { target: { value: '20000' } }); // sum=100k

    fireEvent.click(screen.getByTestId('game-form-submit'));
    expect(await screen.findByTestId('game-form-error')).toHaveTextContent('同点');
    expect(onSubmitGame).not.toHaveBeenCalled();
  });

  it('submits a valid Game and calls onSubmitGame with the parsed payload', async () => {
    const onSubmitGame = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchDetailScreen
        data={makeDetail()}
        onSubmitGame={onSubmitGame}
        onDeleteGame={vi.fn()}
        origin="https://example.com"
      />,
    );
    fireEvent.click(screen.getByTestId('match-detail-add-game'));

    fireEvent.change(screen.getByTestId('game-form-player-input-0'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-1'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-2'), { target: { value: 'p3' } });
    fireEvent.change(screen.getByTestId('game-form-player-input-3'), { target: { value: 'p4' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-0'), { target: { value: '40000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-1'), { target: { value: '30000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-2'), { target: { value: '20000' } });
    fireEvent.change(screen.getByTestId('game-form-score-input-3'), { target: { value: '10000' } });

    fireEvent.click(screen.getByTestId('game-form-submit'));
    await waitFor(() => expect(onSubmitGame).toHaveBeenCalledTimes(1));
    const payload = onSubmitGame.mock.calls[0][0];
    expect(payload.matchId).toBe('m1');
    expect(payload.gameId).toBeNull();
    expect(payload.players).toHaveLength(4);
    expect(payload.players.map((p: { rawScore: number }) => p.rawScore)).toEqual([
      40000, 30000, 20000, 10000,
    ]);
  });

  it('opens the delete modal and calls onDeleteGame with the game id', async () => {
    const onDeleteGame = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchDetailScreen
        data={makeDetail()}
        onSubmitGame={vi.fn()}
        onDeleteGame={onDeleteGame}
        origin="https://example.com"
      />,
    );
    fireEvent.click(screen.getByTestId('match-detail-game-delete-game-1'));
    fireEvent.click(screen.getByTestId('game-delete-modal-confirm'));
    await waitFor(() => expect(onDeleteGame).toHaveBeenCalledWith('game-1'));
  });

  it('renders the empty-state when no games exist and disables the CTA when there are not enough players', () => {
    render(
      <MatchDetailScreen
        data={makeDetail({
          games: [],
          ranking: [],
          availablePlayers: [{ id: 'p1', name: 'たかし', isActive: true }],
        })}
        onSubmitGame={vi.fn()}
        onDeleteGame={vi.fn()}
        origin="https://example.com"
      />,
    );
    expect(screen.getByTestId('match-detail-games-empty')).toBeInTheDocument();
    expect(screen.getByTestId('match-detail-ranking-empty')).toBeInTheDocument();
    expect(screen.getByTestId('match-detail-add-game-disabled')).toBeInTheDocument();
    expect(screen.getByTestId('match-detail-add-game')).toBeDisabled();
  });
});
