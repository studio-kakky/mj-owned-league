---
name: do-pr-review
description: studio-kakky/mj-owned-league リポジトリ専用。GitHub PR 番号と「レビュー / マージ / merge / 確認」系の意図が組み合わさった発話（「PR #N レビューして」「#N マージ」「PR #N をレビューしてマージ」「review and merge #N」など）でトリガーされる。PR を取得し、リンク Issue の受け入れ基準との照合・コード品質（TS/React）・セキュリティ・CI/conflict 状態を順に確認し、すべて green なら自動で squash merge + ブランチ削除まで実行する。指摘があれば PR にレビューコメントを投稿して停止する。PR 番号があり、「レビュー / マージ / 確認」系の語と一緒に出てきたら必ず起動すること。新規 PR 作成、PR への追加コミットのみの依頼、merge せずレビューだけする依頼、PR の draft 化では起動しない。
---

# do-pr-review

mj-owned-league の PR を **レビュー → 問題なければ自動 merge → ブランチ削除** まで実行するワークフロー。`do-issue` の自然な後続スキル。

## なぜこのスキルが必要か

このリポは Issue 駆動。`do-issue` が PR を作るので、その PR を「品質確認 → merge」までを毎回ゼロから組み立てるのは無駄。受け入れ基準充足 / コード品質 / セキュリティ / CI / conflict の 5 軸を網羅し、すべて green なら自動 merge する型を skill にすることで、見落としとマージ作業の摩擦を両方減らす。

## 前提（このリポ専用）

- PR body に `Closes #N` / `Refs #N` の形で Issue が紐付いている（do-issue が必ず付ける）
- Issue body に `## 受け入れ基準` のチェックリストがある
- CI が PR で走り、`gh pr checks` で状態取得できる（#8 完了後）
- リポの merge 方式は **squash merge**（history をクリーンに保つ）

これらが揃わない PR では `gh pr checks` 等が空を返すことがある。その場合は「CI 未整備のためコード品質 + セキュリティの軸のみで判定する」と明示してから進む。

## ワークフロー

### 1. PR を取得

```bash
gh pr view <N> --json number,title,body,state,mergeable,mergeStateStatus,headRefName,baseRefName,labels,closingIssuesReferences,additions,deletions,changedFiles,url
```

判定:

- `state: OPEN` でなければ（CLOSED / MERGED）状況を伝えて終了
- `additions + deletions > 1000` → 「大きすぎる」警告のみ、停止はしない
- `headRefName == "main"` → 異常、ユーザーに確認

### 2. リンクされた Issue を取得

`closingIssuesReferences` または PR body の `Closes #M` / `Refs #M` を抽出。各 Issue について:

```bash
gh issue view <M> --json number,title,body,state,labels,url
```

`body` から `## 受け入れ基準` セクションの `- [ ]` / `- [x]` 行を抜き出して受け入れ基準リストを構築する。

リンク Issue が無い場合は受け入れ基準照合をスキップし、その旨をレビュー結果に明記する。

### 3. CI / Conflict 状態を確認

#### CI

```bash
gh pr checks <N>
```

- すべて `pass` → OK
- `fail` がある → **ブロッカー**。失敗 check の名前を控え、ユーザーに伝えて停止
- `pending` がある → 最大 5 回（30 秒間隔）で再 check。それでも pending なら「CI 完了を待ってから再起動してください」と伝えて停止
- 出力が空（checks が定義されていない）→ 「CI 未整備のためスキップ」とメモして続行

#### Conflict / mergeable

```bash
gh pr view <N> --json mergeable,mergeStateStatus
```

- `mergeable: MERGEABLE` && `mergeStateStatus: CLEAN` / `HAS_HOOKS` → OK
- `mergeStateStatus: BEHIND` → 「main を rebase / merge してください」と伝えて停止
- `mergeStateStatus: DIRTY` → conflict あり。停止
- `mergeStateStatus: BLOCKED` → branch protection で blocked（承認待ちなど）。停止
- `UNKNOWN` → GitHub 側で計算中。1 回 retry してそれでも UNKNOWN なら停止

### 4. Diff を取得

```bash
gh pr diff <N> > /tmp/pr-<N>-diff.patch
```

ファイル全体を読む必要があれば `gh pr view <N> --json files` で変更ファイル名を取得して個別に Read。

### 5. レビューを実施

以下 3 軸を順に評価し、それぞれの結果を **構造化メモ** に記録する。コード関連の指摘は **必ず `path` + `line` を控えておく**（あとで inline comment にする）。

メモのフォーマット例:

```jsonc
{
  "summary": "受け入れ基準 3/4 ✅、コード品質に 2 件、セキュリティ問題なし",
  "acceptance": [
    {"text": "...", "status": "ok"},
    {"text": "...", "status": "unclear", "reason": "..."}
  ],
  "inline": [
    {"path": "apps/web/src/foo.ts", "line": 42, "side": "RIGHT", "body": "any → unknown に置き換え推奨"},
    {"path": "apps/web/src/bar.tsx", "line": 87, "side": "RIGHT", "body": "Server Component のままで OK。client-only state は子に分離"}
  ]
}
```

#### 5a. Issue 受け入れ基準との照合

各受け入れ基準について、diff の変更内容と照らし合わせて以下のいずれかを判定:

- ✅ **満たしている** — 該当の変更が diff に明確にある
- ⚠️ **判断困難** — diff から読み取れない（doc 上の理由、テスト不足、目視確認が必要）
- ❌ **満たしていない** — 該当の変更が無い、または受け入れ基準と矛盾する

受け入れ基準がもともと `- [x]` でチェック済みの行は、PR 作成者（= do-issue）が達成済みと判断しているもの。再判定では信用してよいが、明らかに矛盾する変更が無いかだけ確認する。

#### 5b. コード品質（TypeScript / React）

リポの規約を踏まえて diff をレビュー:

- TypeScript: `any` の使用、型不整合、SOLID 違反、Zod / drizzle-zod の活用漏れ
- React: Server Component / Client Component の使い分け、key prop、`useEffect` の依存配列、`useMemo` / `useCallback` の使いどころ
- TanStack: Router の loader 設計、Query のキャッシュキー設計
- 命名 / 構造 / 重複の有無

利用可能なら `frontend-code-review` スキル / `typescript-implementation` スキル / `vercel-react-best-practices` スキルを参照する。

#### 5c. セキュリティ

`/security-review` スキルを呼ぶ。観点:

- OWASP top 10（XSS, CSRF, SQL injection, etc.）
- シークレット / トークン混入（`.env` / `.dev.vars`）
- 入力検証の漏れ（Zod での validation）
- 認証 / 認可（Better Auth のセッションチェック、公開閲覧と Owner 用の境界）
- 公開閲覧画面で編集 UI が露出していないか

### 6. 判定とアクション

すべて green の定義: 受け入れ基準が全て ✅、CI green、conflict なし、コード品質 / セキュリティ いずれの指摘もなし。

| 状況 | アクション |
|---|---|
| すべて green | **自動 squash merge + ブランチ削除**（Step 7） |
| いずれかが ⚠️ / ❌ / 指摘あり | **PR にレビューコメント投稿して停止**（Step 8） |

### 7. 自動 merge 実行

```bash
gh pr merge <N> --squash --delete-branch
```

merge 後に確認:

```bash
gh pr view <N> --json state,mergeCommit,mergedAt
```

`state: MERGED` を確認。merge 失敗（branch protection / 競合発生）した場合は理由を表示してユーザーに引き継ぐ。

merge 後、ローカルブランチも掃除:

```bash
git switch main && git pull --ff-only
git branch -d <headRefName> 2>/dev/null || true
```

### 8. 指摘ありの場合

レビューは **インラインコメント + 全体サマリ** の形で投稿する。GitHub API を直接叩く（`gh pr review` の `--body` だけだと top-level コメントになり、コード行に紐付かない）。

#### 8a. JSON ペイロードを構築

Step 5 の構造化メモを元に、以下の形で JSON を組み立てる:

```jsonc
{
  "event": "REQUEST_CHANGES",
  "body": "## 自動レビュー結果\n\n### 受け入れ基準\n- ✅ ...\n- ⚠️ ...\n\n### CI / Conflict\n- ...\n\nコード行への指摘は inline コメントを参照。\n\n修正後、`#<N> レビューして` で再起動してください。",
  "comments": [
    {
      "path": "apps/web/src/foo.ts",
      "line": 42,
      "side": "RIGHT",
      "body": "`any` → `unknown` に置き換え推奨。受信側で型ガードを書く。"
    },
    {
      "path": "apps/web/src/bar.tsx",
      "line": 87,
      "side": "RIGHT",
      "body": "Server Component に `useState` が紛れている。`'use client'` を子コンポーネントに分離する。"
    }
  ]
}
```

#### 8b. レビュー投稿

```bash
gh api -X POST "repos/studio-kakky/mj-owned-league/pulls/<N>/reviews" \
  --input /tmp/pr-<N>-review.json
```

注意:

- `line` は **PR の diff ファイル内の右側（変更後）の行番号**。base side のコメントを付けたい場合は `"side": "LEFT"` を使う
- 複数行ブロックに対するコメントは `start_line` + `line` を使う:
  `{"path": "...", "start_line": 10, "line": 15, "side": "RIGHT", "body": "..."}`
- `event` は指摘あり時は `REQUEST_CHANGES`、軽微なメモ程度なら `COMMENT`、承認なら `APPROVE`

#### 8c. ユーザーに報告

「PR にレビューコメントを N 件投稿しました。修正後、`#<N> レビューして` で再起動してください」と伝え、レビュー URL（`gh pr view <N> --json url` ＋ `/files` フラグメント）を返す。

### 9. ユーザーに報告

#### 自動 merge した場合
- merge URL / merge commit SHA / 削除した branch 名
- Closes された Issue 番号
- 「ローカルの `main` も最新に追従しました」

#### 指摘ありで停止した場合
- 指摘の件数と概要
- レビューコメント URL
- 修正方針の提案（軽微なら自動で fixup commit を提案可、ただし実行はユーザー指示後）

## エッジケース

| 状況 | 対処 |
|---|---|
| リンク Issue が無い | 受け入れ基準照合をスキップ、コード品質 + セキュリティのみで判定する旨を明示 |
| PR が draft | 「draft のためレビュー対象外」として停止 |
| CI が定義されていない（#8 未完） | CI 軸をスキップする旨を明示して続行 |
| Diff が巨大（1000 行超） | 警告し、分割を提案。ただし停止はしない |
| すでに承認済み（自分以外がレビュー済み） | レビューは差分のみ実施、approve は upsert しない |
| `mergeStateStatus: BLOCKED` で branch protection 由来 | ユーザーに「protection 設定を確認してください」と伝えて停止 |
| 自動 merge 後に CI が走り直して failure | ユーザーに通知（あとは revert / hotfix の判断） |

## トリガー除外

- 新規 PR を作成する依頼（`pr-create` スキルへ）
- PR に追加コミットを push する依頼
- PR を draft に変更する依頼
- PR を merge せずレビューだけしてコメントを残す依頼（→ `/review` スキル）
- PR を close する依頼
