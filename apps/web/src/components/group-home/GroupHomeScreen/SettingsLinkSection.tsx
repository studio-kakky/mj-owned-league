import { Link } from '@tanstack/react-router';

export const SettingsLinkSection = ({ groupId }: { groupId: string }) => {
  return (
    <section className="space-y-3" data-testid="group-home-settings-section">
      <h2 className="text-sm font-semibold text-zinc-200">グループ設定</h2>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="group-home-settings-links">
        <li>
          <Link
            to="/settings"
            search={{ groupId }}
            data-testid="group-home-settings-players-link"
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
          >
            <span>
              <span className="block text-sm font-semibold text-zinc-100">プレイヤー管理</span>
              <span className="mt-1 block text-xs text-zinc-500">追加 / 編集 / 非アクティブ化</span>
            </span>
            <span className="shrink-0 text-xs text-emerald-300">設定 →</span>
          </Link>
        </li>
        <li>
          <Link
            to="/settings"
            search={{ groupId }}
            data-testid="group-home-settings-rulesets-link"
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
          >
            <span>
              <span className="block text-sm font-semibold text-zinc-100">Ruleset 管理</span>
              <span className="mt-1 block text-xs text-zinc-500">追加 / 編集 / デフォルト切替</span>
            </span>
            <span className="shrink-0 text-xs text-emerald-300">設定 →</span>
          </Link>
        </li>
      </ul>
    </section>
  );
};
