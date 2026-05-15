import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <section className="max-w-md w-full space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">JANROKU</p>
        <h1 className="text-4xl font-bold text-zinc-50">麻雀独立リーグ記録</h1>
        <p className="text-sm text-zinc-400">
          TanStack Start + Tailwind + Biome + Vitest + Playwright
          のスキャフォールドが起動しています。
        </p>
        <a
          href="/tailwind-check"
          className="inline-block rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 transition-colors"
        >
          Tailwind 疎通テストへ
        </a>
      </section>
    </main>
  );
}
