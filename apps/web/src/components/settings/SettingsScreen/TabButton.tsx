interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}

export const TabButton = ({ label, active, onClick, testId }: TabButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
        active
          ? 'bg-emerald-500 font-semibold text-zinc-950'
          : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
      }`}
    >
      {label}
    </button>
  );
};
