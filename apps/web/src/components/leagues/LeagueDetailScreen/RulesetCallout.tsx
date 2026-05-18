import type { LeagueDetailData } from '../types';

export const RulesetCallout = ({ data }: { data: LeagueDetailData }) => {
  if (data.defaultRuleset === null) {
    return (
      <section
        data-testid="league-detail-ruleset-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400"
      >
        既定の Ruleset は未設定です。各対局で個別に Ruleset を選択してください。
      </section>
    );
  }
  const r = data.defaultRuleset;
  return (
    <section
      data-testid="league-detail-ruleset"
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">適用 Ruleset</p>
      <p className="text-sm font-semibold text-zinc-100">
        {r.name}
        {r.isGroupDefault ? (
          <span className="ml-2 text-[10px] font-medium text-emerald-300">グループの既定</span>
        ) : null}
      </p>
      <p className="text-xs text-zinc-500">
        持ち点 {r.startingScore.toLocaleString()} / 返し点 {r.returnScore.toLocaleString()} / ウマ{' '}
        {r.umaPattern}
      </p>
    </section>
  );
};
