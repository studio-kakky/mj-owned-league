export const SummaryPill = ({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: string;
}) => {
  return (
    <div data-testid={testId} className="flex flex-col gap-1 bg-[#0E0E0E] px-2 py-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#666666]">{label}</dt>
      <dd className="truncate text-sm font-semibold text-[#FAFAF8]">{value}</dd>
    </div>
  );
};
