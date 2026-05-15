# mj-owned-league (JANROKU)

麻雀独立リーグの記録 / 集計サービス。仕様は `docs/docs/01-overview.md` 以降を参照。

## モノレポ構成

```
.
├─ apps/
│  └─ web/        # TanStack Start アプリ + Cloudflare Worker エントリ
├─ docs/          # Docusaurus による仕様ドキュメント
├─ pnpm-workspace.yaml
└─ README.md
```

パッケージマネージャは pnpm。Node.js は `package.json` の `packageManager` フィールドに従う。

## セットアップ

```bash
pnpm install
```

## ドキュメントサイト（Docusaurus）

```bash
pnpm --filter docs start
```

`docs/` 配下のマークダウンを編集すると即座に反映される。

## apps/web: ローカル開発

`apps/web` は 2 系統の開発サーバを持つ。

### 1. Vite 開発サーバ（TanStack Start の SSR/HMR）

UI 実装中はこれを使う。Workers ランタイムは経由しない。

```bash
pnpm --filter web dev
```

### 2. Wrangler ローカル Worker（D1 動作確認用）

Cloudflare Workers + D1 の動作を Miniflare 経由でローカル再現する。実 Cloudflare アカウントは不要。

```bash
# 1) ローカル用の secrets ファイルを用意（初回のみ）
cp apps/web/.dev.vars.example apps/web/.dev.vars

# 2) Worker を起動
pnpm --filter web worker:dev
```

`http://127.0.0.1:8787` で待ち受け、状態は `apps/web/.wrangler/state/` 配下に永続化される（`--persist-to`）。

動作確認用のエンドポイント:

| Path | 動作 |
|---|---|
| `GET /api/health` | Worker 自体の死活確認 |
| `GET /api/db/ping` | `SELECT 1` を D1 に投げて疎通確認 |

```bash
curl http://127.0.0.1:8787/api/db/ping
# => {"status":"ok","ping":1}
```

`.wrangler/state/` は gitignore 済み。スキーマを作り直したい場合はディレクトリを丸ごと削除する。

### Worker のソース

- `apps/web/worker/index.ts` — Worker エントリ（最小実装）
- `apps/web/wrangler.toml` — Workers + D1 バインディング設定
- `apps/web/.dev.vars.example` — ローカル用 secrets テンプレ（実値は `apps/web/.dev.vars` に置く / gitignore 済み）

> 現状の Worker はローカル D1 疎通確認用の最小実装。TanStack Start の SSR / サーバ関数を Workers ランタイムで動かす本格的な統合は follow-up issue で対応する。

## TODO: follow-up issue で対応

本 PR （issue #5）のスコープから外し、後続 issue で対応する項目:

1. **実 D1 データベースの作成** — `wrangler d1 create janroku-preview` / `wrangler d1 create janroku-production` を実行し、`wrangler.toml` の `database_id` プレースホルダ（`local-dev-placeholder`）を置き換える。`[env.preview]` / `[env.production]` ブロックの整備もここで行う。
2. **Cloudflare API トークンの設定** — GitHub Actions Secrets に `CLOUDFLARE_API_TOKEN` を登録し、CI から `wrangler deploy` できる状態にする。
3. **TanStack Start ↔ Workers 統合** — SSR と server functions を Worker 上で動かし、server function から D1 binding にアクセスできるようにする。
4. **Drizzle ORM + drizzle-kit セットアップ** — D1 用スキーマ定義とマイグレーション生成 / 適用フロー。
5. **本番デプロイ** — `wrangler deploy` と Preview Deploy の自動化。

## 検証

```bash
pnpm --filter web typecheck   # tsc --noEmit
pnpm --filter web check       # biome (lint + format)
pnpm --filter web test        # vitest run
```
