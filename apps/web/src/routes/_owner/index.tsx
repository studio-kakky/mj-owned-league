/**
 * S3 Owner ダッシュボード — temporary scaffold.
 *
 * The real S3 implementation (recent games / active leagues / group cards /
 * pending invitation count, per `04-screens.md` § S3) belongs to its own
 * issue. This route exists so:
 *   1. The Owner shell (Issue #11) actually has a page to render under `/`.
 *   2. `pnpm --filter web dev` shows the header + bottom-nav working end-to-
 *      end when the developer visits `http://localhost:3000/`.
 *
 * When S3 lands, this body is replaced; the route file stays.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/')({
  component: OwnerHomePage,
});

function OwnerHomePage() {
  return (
    <section className="space-y-4">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Dashboard</p>
      <h1 className="text-2xl font-bold text-zinc-50">ホーム</h1>
      <p className="text-sm text-zinc-400">
        共通レイアウト（ヘッダー / フッター / グループ切替シート）の動作確認用ページです。 S3 Owner
        ダッシュボードは別 Issue で実装されます。
      </p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
        <p className="font-medium text-zinc-100">確認ポイント</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-400">
          <li>ヘッダー右上のグループ切替ボタン（未ログイン時は無効）</li>
          <li>下部の 4 タブナビ（ホーム / リーグ / マッチ / 設定）</li>
          <li>375pt モバイル幅での視認性</li>
        </ul>
      </div>
    </section>
  );
}
