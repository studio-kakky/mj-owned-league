import { createFileRoute } from '@tanstack/react-router';

const TailwindCheckPage = () => {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Sanity check</p>
          <h1 className="text-3xl font-bold text-zinc-50">Tailwind 疎通テスト</h1>
          <p className="text-sm text-zinc-400">
            このページで色・タイポ・余白・角丸・shadow が適用されていれば Tailwind
            は動作しています。
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3" data-testid="palette">
          <div className="h-16 rounded-lg bg-emerald-500" />
          <div className="h-16 rounded-lg bg-sky-500" />
          <div className="h-16 rounded-lg bg-rose-500" />
          <div className="h-16 rounded-lg bg-amber-500" />
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-zinc-100">カード</h2>
          <p className="mt-2 text-sm text-zinc-400">
            border / bg / padding / shadow / typography が反映されていれば OK。
          </p>
        </section>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/tailwind-check')({
  component: TailwindCheckPage,
});
