/**
 * `/leagues` — placeholder route for the bottom-nav "リーグ" tab.
 *
 * The real League list / dashboard is S7 / S15 (`04-screens.md`); those are
 * separate issues. This file exists only so the bottom-nav link resolves
 * while the common layout (Issue #11) is being verified end-to-end.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/leagues')({
  component: LeaguesPlaceholder,
});

function LeaguesPlaceholder() {
  return <PlaceholderBody title="リーグ" sectionLabel="Leagues" />;
}

function PlaceholderBody({ title, sectionLabel }: { title: string; sectionLabel: string }) {
  return (
    <section className="space-y-3">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{sectionLabel}</p>
      <h1 className="text-2xl font-bold text-zinc-50">{title}</h1>
      <p className="text-sm text-zinc-400">
        本画面の実装は別 Issue で対応します（プレースホルダー）。
      </p>
    </section>
  );
}
