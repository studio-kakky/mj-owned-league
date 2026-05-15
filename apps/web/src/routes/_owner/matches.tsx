/**
 * `/matches` — placeholder route for the bottom-nav "マッチ" tab.
 *
 * Real Match list / dashboard (S9, S10) is tracked in dedicated issues.
 * See sibling `leagues.tsx` for the same rationale.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/matches')({
  component: MatchesPlaceholder,
});

function MatchesPlaceholder() {
  return (
    <section className="space-y-3">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Matches</p>
      <h1 className="text-2xl font-bold text-zinc-50">マッチ</h1>
      <p className="text-sm text-zinc-400">
        本画面の実装は別 Issue で対応します（プレースホルダー）。
      </p>
    </section>
  );
}
