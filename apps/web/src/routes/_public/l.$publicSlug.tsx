/**
 * `/l/:publicSlug` — temporary scaffold for P1 League 公開ページ.
 *
 * Issue #11 only owns the layout shell; the actual P1 content (順位表 /
 * Match 一覧 / 対局履歴) is a follow-up. This route renders inside
 * `PublicShell` and shows the `publicSlug` param so a developer can
 * eyeball that the public layout wraps the page correctly.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_public/l/$publicSlug')({
  component: PublicLeaguePlaceholder,
});

function PublicLeaguePlaceholder() {
  const { publicSlug } = Route.useParams();
  return (
    <section className="space-y-3">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Public League</p>
      <h1 className="text-2xl font-bold text-zinc-50">公開リーグ</h1>
      <p className="text-sm text-zinc-400">
        slug:{' '}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-emerald-300">{publicSlug}</code>
      </p>
      <p className="text-sm text-zinc-400">
        本画面の実装は P1 として別 Issue で対応します（プレースホルダー）。
      </p>
    </section>
  );
}
