/**
 * `/settings` — placeholder route for the bottom-nav "設定" tab.
 *
 * Real Settings (Player / Ruleset management) is S16; tracked separately.
 * See sibling `leagues.tsx` for the same rationale.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/settings')({
  component: SettingsPlaceholder,
});

function SettingsPlaceholder() {
  return (
    <section className="space-y-3">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Settings</p>
      <h1 className="text-2xl font-bold text-zinc-50">設定</h1>
      <p className="text-sm text-zinc-400">
        本画面の実装は別 Issue で対応します（プレースホルダー）。
      </p>
    </section>
  );
}
