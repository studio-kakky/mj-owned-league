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
    <div data-testid={testId} className="flex flex-col gap-1">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="truncate text-sm font-semibold text-zinc-100">{value}</dd>
    </div>
  );
};
