/**
 * Public-facing layout shell for viewer pages (`/l/:slug`, `/m/:slug`,
 * `/l/:slug/players/:id`).
 *
 * Per Issue #11 acceptance criterion "公開閲覧側では簡略版（編集 UI なし）
 * を提供" this shell deliberately omits:
 *   - Group switcher (viewers have no Owner session)
 *   - Bottom navigation (each public route is a self-contained page)
 *   - Any "edit" / "create" affordance
 *
 * The footer is a thin attribution strip with a link back to the marketing
 * surface (`/login`). Real marketing copy lands in a follow-up issue.
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 bg-zinc-950/95">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-100">
            JANROKU
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">公開ビュー</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-zinc-900 bg-zinc-950">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-6 text-xs text-zinc-500">
          <p>JANROKU は招待制の麻雀リーグ記録サービスです。</p>
          {/*
            The `/login` link is intentionally not wired up yet — the S1 route
            lands in a different issue (and TanStack Router's typed `<Link>`
            would refuse a non-existent target). Once S1 is in the tree,
            replace this with `<Link to="/login">Owner ログイン</Link>`.
          */}
          <p className="text-zinc-300">Owner ログインは別途用意されています。</p>
        </div>
      </footer>
    </div>
  );
}
