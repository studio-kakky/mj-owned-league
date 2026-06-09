import { Link } from '@tanstack/react-router';
import type { LeagueListFilter } from '../types';
import { FILTERS } from './filters';

export const EmptyState = ({
  filter,
  hasAnyLeague,
  hasGroups,
}: {
  filter: LeagueListFilter;
  hasAnyLeague: boolean;
  hasGroups: boolean;
}) => {
  // Empty-state copy depends on three orthogonal conditions:
  //   1. The Owner has no Groups → can't even create a League yet.
  //   2. The Owner has Groups but no Leagues → pitch the create modal.
  //   3. The filter excludes everything → tell the user that, not "empty".
  if (!hasGroups) {
    return (
      <div
        data-testid="leagues-empty-no-groups"
        className="rounded-lg border border-dashed border-[#262626] p-6 text-center text-sm text-[#888888]"
      >
        <p className="font-medium text-[#FAFAF8]">グループがまだありません</p>
        <p className="mt-1 text-xs text-[#666666]">
          まずグループを作成してください。グループからリーグを切り出すことができます。
        </p>
        <Link
          to="/groups"
          className="mt-3 inline-block rounded-full bg-[#FAFAF8] px-4 py-1.5 text-xs font-semibold text-[#0E0E0E] transition-colors hover:bg-white"
        >
          グループへ移動
        </Link>
      </div>
    );
  }

  if (!hasAnyLeague) {
    return (
      <div
        data-testid="leagues-empty-no-leagues"
        className="rounded-lg border border-dashed border-[#262626] p-6 text-center text-sm text-[#888888]"
      >
        <p className="font-medium text-[#FAFAF8]">リーグはまだありません</p>
        <p className="mt-1 text-xs text-[#666666]">
          「＋」ボタンから最初のリーグを作成してください。リーグごとに順位表と公開 URL
          が用意されます。
        </p>
      </div>
    );
  }

  // Filter excluded everything.
  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? '';
  return (
    <div
      data-testid="leagues-empty-filtered"
      className="rounded-lg border border-dashed border-[#262626] p-6 text-center text-sm text-[#888888]"
    >
      <p className="font-medium text-[#FAFAF8]">「{filterLabel}」のリーグはありません</p>
      <p className="mt-1 text-xs text-[#666666]">
        フィルタを「すべて」に切り替えると、登録済みのリーグを確認できます。
      </p>
    </div>
  );
};
