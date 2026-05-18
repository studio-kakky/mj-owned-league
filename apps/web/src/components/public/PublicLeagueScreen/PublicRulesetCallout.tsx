import type { PublicRulesetSummary } from '../types';

export const PublicRulesetCallout = ({ ruleset }: { ruleset: PublicRulesetSummary | null }) => {
  if (ruleset === null) {
    return (
      <section
        data-testid="public-league-ruleset-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400"
      >
        既定の Ruleset は未設定です。
      </section>
    );
  }
  return (
    <section
      data-testid="public-league-ruleset"
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">適用 Ruleset</p>
      <p className="text-sm font-semibold text-zinc-100">{ruleset.name}</p>
      <p className="text-xs text-zinc-500">
        持ち点 {ruleset.startingScore.toLocaleString()} / 返し点{' '}
        {ruleset.returnScore.toLocaleString()} / ウマ {ruleset.umaPattern}
        {ruleset.tobiPoint === null ? ' / 飛び賞なし' : ` / 飛び賞 ${ruleset.tobiPoint}`}
      </p>
    </section>
  );
};
