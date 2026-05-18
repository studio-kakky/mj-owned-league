import type { MatchDetailData } from '../detail-types';

export const RulesetCallout = ({ ruleset }: { ruleset: MatchDetailData['defaultRuleset'] }) => {
  if (ruleset === null) {
    return (
      <section
        data-testid="match-detail-ruleset-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400"
      >
        既定の Ruleset が未設定です。最初の対局を追加するときに Ruleset を選択してください。
      </section>
    );
  }
  return (
    <section
      data-testid="match-detail-ruleset"
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">適用 Ruleset</p>
      <p className="text-sm font-semibold text-zinc-100">
        {ruleset.name}
        {ruleset.isMatchDefault ? (
          <span className="ml-2 text-[10px] font-medium text-emerald-300">マッチの既定</span>
        ) : ruleset.isGroupDefault ? (
          <span className="ml-2 text-[10px] font-medium text-zinc-400">グループの既定</span>
        ) : null}
      </p>
      <p className="text-xs text-zinc-500">
        持ち点 {ruleset.startingScore.toLocaleString()} / 返し点{' '}
        {ruleset.returnScore.toLocaleString()} / ウマ {ruleset.umaPattern}
        {ruleset.tobiEnabled ? ` / 飛び賞 ${ruleset.tobiPoint ?? 0}` : ' / 飛び賞なし'}
      </p>
    </section>
  );
};
