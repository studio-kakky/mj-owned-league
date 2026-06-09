import { Link } from '@tanstack/react-router';
import { ChevronRight } from './GroupHomeSection';

export const SettingsLinkSection = ({ groupId }: { groupId: string }) => {
  return (
    <section className="mt-7" data-testid="group-home-settings-section">
      <div className="mb-2.5 px-5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#888888]">
          グループ設定
        </span>
      </div>
      <div data-testid="group-home-settings-links">
        <Link
          to="/settings"
          search={{ groupId }}
          data-testid="group-home-settings-players-link"
          className="flex items-center justify-between gap-3 border-t border-[#1F1F1F] px-5 py-3.5 transition-colors hover:bg-[#141414]"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-[#FAFAF8]">プレイヤー管理</span>
            <span className="mt-0.5 block text-xs text-[#666666]">
              追加 / 編集 / 非アクティブ化
            </span>
          </span>
          <ChevronRight className="shrink-0 text-[#888888]" />
        </Link>
        <Link
          to="/settings"
          search={{ groupId }}
          data-testid="group-home-settings-rulesets-link"
          className="flex items-center justify-between gap-3 border-t border-b border-[#1F1F1F] px-5 py-3.5 transition-colors hover:bg-[#141414]"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-[#FAFAF8]">Ruleset 管理</span>
            <span className="mt-0.5 block text-xs text-[#666666]">
              追加 / 編集 / デフォルト切替
            </span>
          </span>
          <ChevronRight className="shrink-0 text-[#888888]" />
        </Link>
      </div>
    </section>
  );
};
