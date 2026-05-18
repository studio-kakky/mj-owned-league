export const SummaryCell = ({ label, value }: { label: string; value: string }) => {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-zinc-100">{value}</dd>
    </div>
  );
};
