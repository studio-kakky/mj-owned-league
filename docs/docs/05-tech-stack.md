---
sidebar_position: 5
---

# 技術スタック

`01-overview.md` 〜 `04-screens.md` で定義した要件を実現するための、採用技術と構成方針を整理する。実装フェーズで個別に判断する細部は「仮置き事項」にまとめる。

## 全体像

| レイヤー | 採用技術 |
|---|---|
| 言語 | TypeScript（`strict` 有効） |
| フレームワーク | TanStack Start |
| ルーティング / データ取得 | TanStack Router + TanStack Query（TanStack Start に同梱） |
| フォーム | `@tanstack/react-form` |
| 入力検証 | Zod（+ `drizzle-zod` でスキーマ自動生成） |
| 認証 | Better Auth（Drizzle アダプタ + D1） |
| ORM | Drizzle ORM + `drizzle-kit` |
| データベース | Cloudflare D1（SQLite） |
| ホスティング / ランタイム | Cloudflare Workers（Wrangler） |
| Lint / Format | Biome |
| 単体・コンポーネントテスト | Vitest + React Testing Library |
| E2E テスト | Playwright |
| CI/CD | GitHub Actions + Cloudflare Preview Deploy |
| シークレット管理 | `.dev.vars`（ローカル）/ `wrangler secret`（本番） |

## 採用理由（要点）

- **TanStack Start + Cloudflare Workers** — フルスタック TypeScript で完結し、Cloudflare へのデプロイが公式サポートされている。Router / Query / Form と同系列のエコシステムでフロントとサーバ関数を一貫して書ける。
- **Cloudflare D1** — SQLite ベースで MVP のスケールに十分。Workers と密接に連携し、Wrangler 経由でローカルとの差を最小化できる。
- **Drizzle ORM** — TypeScript ファースト・D1 公式サポート・マイグレーション機構（`drizzle-kit`）が揃う。`drizzle-zod` で DB スキーマから Zod スキーマを派生でき、入力検証との二重管理を避けられる。
- **Better Auth** — Drizzle アダプタを公式提供。招待制（公開サインアップなし）の要件（`03-user-flow.md` F1）にも対応しやすい。
- **Biome** — Lint と Formatter が一体・設定がシンプル・実行が高速。greenfield プロジェクトの初期コストが小さい。
- **Vitest + RTL + Playwright** — Vitest は Vite 系のビルドと相性が良く、TanStack Start とも噛み合う。公開 URL ビュー（認証なし）/ Owner ビュー（認証あり）の分岐は E2E でしか拾えないため Playwright を併用する。

## レイヤー別の構成方針

### フレームワーク / ランタイム

- TanStack Start のサーバ関数（server function）を API 層として用い、別途 REST/GraphQL を立てない。
- Cloudflare Workers にデプロイし、SSR と API の両方を Workers ランタイムで動かす。
- バージョンは `package.json` でピン留め（`^` を避ける）し、Renovate もしくは Dependabot で追従する。

### データレイヤー

- Drizzle で D1 用のスキーマを定義（`schema.ts`）し、`drizzle-kit` でマイグレーションファイルを生成。
- 本番への適用は CI から `wrangler d1 migrations apply <DB_NAME>` を実行。
- SQLite には `decimal` 型が無いため、`GameResult.points` は **`real`（浮動小数点）** で保持する。表示時に小数第 1 位で丸める（`02-domain-model.md` の `+12.0` 等の表記と整合）。
- `02-domain-model.md` の `decimal` 表記はドメイン上の意味であり、物理スキーマは `real` で実装する旨を本ドキュメントで上書きする。

### 認証

- Better Auth + Drizzle アダプタを使用。セッションは D1 に保存する。
- メール + パスワード方式、招待制。公開サインアップは無効化する。
- 招待トークンの管理（生成・検証・消費・取消）は Better Auth の機能では足りない部分があれば自前のテーブルを追加し、Drizzle で管理する。
- 公開閲覧（`/l/:publicSlug` 等）は認証不要のため、ルートレベルで認証ガードの有無を切り替える。

### フォーム / バリデーション

- フォームは `@tanstack/react-form`。
- スキーマは Zod に統一し、**クライアント側の入力検証** と **サーバ関数の入力検証** で同じ Zod スキーマを共有する。
- Drizzle のテーブル定義からは `drizzle-zod` で派生スキーマを作り、API 入出力との二重管理を避ける。
- 整合性検証（例: `02-domain-model.md` の「`rawScore` 合計 === `startingScore × 人数`」）は、Zod の `refine` ではなくサーバ側のサービス層で行う（複数レコードを跨ぐ検証のため）。

### スタイリング

- 未決（仮置き）。候補は Tailwind CSS + shadcn/ui、Panda CSS、CSS Modules など。実装着手時に確定する。

### テスト

- **単体 / コンポーネント**: Vitest + React Testing Library。
- **E2E**: Playwright。MVP では最低 1 本（招待受諾 → Group 作成 → Player 登録 → Game 入力 → 公開 URL 閲覧）を CI に組み込む。
- **DB を伴うテスト**: Workers のローカル環境（`wrangler dev` / Miniflare）を経由するか、Drizzle を SQLite ファイル DB に向けて実行する方針。実装フェーズで決定。

### Lint / Format

- Biome（`biome.json`）に集約し、ESLint / Prettier は導入しない。
- コミット前の整形は Husky + lint-staged を導入するか、エディタ統合のみで運用するかは実装フェーズで判断。

### CI/CD

GitHub Actions で次を実行する。

1. 型チェック（`tsc --noEmit`）
2. Lint / Format（`biome ci`）
3. Vitest（単体・コンポーネント）
4. Playwright（PR 時、Preview Deploy 完了後）
5. Cloudflare へのデプロイ
   - PR: Preview Deploy（PR コメントに URL を投稿）
   - `main` マージ後: 本番 Deploy

D1 のマイグレーションは「本番 Deploy の前」に CI で `wrangler d1 migrations apply` を実行する。

### シークレット管理

| 環境 | 方法 |
|---|---|
| ローカル | `.dev.vars`（`.gitignore` に追加） |
| 本番 / プレビュー | `wrangler secret put <KEY>` |
| CI | GitHub Actions Secrets → `wrangler` 経由で適用 |

`CLOUDFLARE_API_TOKEN` / `BETTER_AUTH_SECRET` / `DATABASE_URL`（D1 バインディング名）等を上記いずれかで管理する。

## ディレクトリ構成（仮）

```
.
├─ docs/                         # Docusaurus（本ドキュメント群）
├─ apps/
│  └─ web/                       # TanStack Start アプリ
│     ├─ src/
│     │  ├─ routes/              # TanStack Router のファイルベースルート
│     │  ├─ server/              # サーバ関数（DB アクセス・認証）
│     │  ├─ db/                  # Drizzle スキーマ・クライアント
│     │  ├─ domain/              # ドメインロジック（ポイント計算・整合性検証）
│     │  ├─ components/          # UI コンポーネント
│     │  └─ lib/                 # 共通ユーティリティ
│     ├─ drizzle/                # マイグレーション
│     ├─ tests/                  # Vitest / Playwright
│     ├─ wrangler.toml
│     └─ biome.json
└─ pnpm-workspace.yaml
```

- パッケージマネージャは `pnpm`（既存 `pnpm-workspace.yaml` を踏襲）。
- 単一アプリ構成でも `apps/web/` 配下に置き、将来的に `packages/*` を追加できる余地を残す。

## バージョン管理方針

- 主要依存は `^` ではなくピン留めし、Renovate / Dependabot で PR ベースに上げる。
- TanStack Start・Better Auth はまだ変更頻度が高いため、リリースノートを確認してから上げる運用とする。

## 仮置き事項

| 論点 | 仮置きの方針 |
|---|---|
| スタイリング | 実装フェーズで確定（Tailwind + shadcn/ui を第一候補とする） |
| パッケージマネージャ | `pnpm`（既存 workspace を継続） |
| モノレポ構成 | `apps/web/` 単一から開始、必要になったら `packages/*` を追加 |
| DB を伴うテストの実行方法 | `wrangler dev`(Miniflare) 経由 / SQLite ファイル / モック いずれかを実装フェーズで決定 |
| Husky / lint-staged の導入 | 実装フェーズで判断 |
| マイグレーション適用タイミング | CI の本番 Deploy 直前に `wrangler d1 migrations apply` を実行（仮） |
| ロギング / モニタリング | Cloudflare Workers Logs + 必要に応じて Logpush。専用ツール（Sentry 等）は MVP 対象外 |
| 国際化 (i18n) | MVP は日本語のみ。多言語化は後続フェーズ |
