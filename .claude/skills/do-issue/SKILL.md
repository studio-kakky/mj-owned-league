---
name: do-issue
description: studio-kakky/mj-owned-league リポジトリ専用。GitHub Issue 番号と着手の意図を示す発話（「issue #N やって」「#N やろ」「#N やってよ」「#N 実装」「#N に着手」「issue N お願い」「issue やる」など）でトリガーされる。Issue を取得して関連ドキュメント・デザイン・依存 Issue を読み込み、計画 → ブランチ作成 → 実装 → 型・Lint・テスト → コミット → PR 作成まで一気通貫で実行する。Issue 番号があり、「やる / やって / 実装 / 着手 / 進める / お願い」系の語が一緒に出てきたら必ず起動すること。Issue 起票・閲覧・PR レビューだけの依頼や、Issue 番号のない一般的な実装依頼では起動しない。
context: fork
---

# do-issue

mj-owned-league の GitHub Issue を 1 件、**Issue → PR** まで完遂させるためのワークフロー。Issue 番号と「やる」系の動詞を含む発話（「issue #12 やって」「#10 やろ」など）で起動する。

## なぜこのスキルが必要か

このリポでは Issue body に **概要 / 関連ドキュメント / デザイン / 受け入れ基準 / 依存** の決まった形式が入っている。形式に沿って「ドキュメントを読む → デザインを取得する → 依存 Issue の状態を確認する → ブランチを切る → 実装する → 検証する → PR を出す」までを毎回ゼロから組み立てるのは無駄が大きい。決まった作業順序を skill 化することで、見落とし（依存 Issue の確認漏れ・デザイン読み忘れ・コミット粒度のズレ）を防ぐ。

## 前提（このリポ専用）

Issue body は以下の形式に従っている。スキルはこれに依存して body を解釈する。

- `## 概要` — タスクの概要
- `## 関連ドキュメント` — `docs/docs/0X-*.md` などへの参照
- `## デザイン` — 「人向け」(`claude.ai/design/p/...?file=...`) と「Claude Code 向け」(`api.anthropic.com/v1/design/h/...?open_file=...`) の 2 つの URL（画面系のみ）
- `## 受け入れ基準` — `- [ ]` 形式のチェックリスト
- `## 依存` — 依存 Issue（`#N`）の列挙

ラベルは `infra` / `domain` / `screen` / `public` / `spec` の 5 種類のいずれかが付与されている。

これらが揃っていない他リポでは意図通りに動かない。

## ワークフロー

### 1. Issue を取得して概要を掴む

```bash
gh issue view <N> --json number,title,body,labels,state,url
```

`state` が `CLOSED` なら止めてユーザーに確認する（誤って閉じた Issue を再着手するケース）。ラベルをメモする。

### 2. ラベルから方針を決める

ラベルごとに参照すべきドキュメントと進め方が違う:

| ラベル | 必須参照 doc | 進め方 |
|---|---|---|
| `infra` | `docs/docs/05-tech-stack.md` | 公式 CLI / テンプレートを優先。`apps/web` 配下のパッケージ追加は `pnpm --filter web add ...` |
| `domain` | `docs/docs/02-domain-model.md` | 純粋関数中心。`tdd` スキルが使えるなら呼んでテストファースト |
| `screen` | `docs/docs/04-screens.md` + デザイン URL | `react-component` / `typescript-implementation` スキルが使えるなら活用。モバイル 375pt を基準 |
| `public` | `docs/docs/04-screens.md` (P1-P4) + デザイン URL | 編集 UI なし、ヘッダー/フッターは簡略版 |
| `spec` | 該当 doc 一式（02-05） | コードは触らずドキュメント編集が主。影響 Issue の body も更新する |

### 3. 関連ドキュメント / デザインを読む

#### 関連ドキュメント

Issue body の「## 関連ドキュメント」に列挙されたファイルを Read で開く。アンカー（`S1. ログイン` など）が指定されていればそのセクションを中心に読む。

#### デザイン（screen / public ラベル時のみ）

「## デザイン」に Claude Code 向け URL（`api.anthropic.com/v1/design/h/<hash>?open_file=<File>.html`）が記載されているはず。WebFetch ではなく `curl` で直接落として展開する:

```bash
mkdir -p /tmp/janroku-design && \
curl -sL "<Claude Code 向け URL>" -o /tmp/janroku-design/bundle.tar.gz && \
tar -xzf /tmp/janroku-design/bundle.tar.gz -C /tmp/janroku-design
```

展開後、`mj-independent-league/project/<File>.jsx` がデザインの実体。これを Read してレイアウト・色・タイポを把握する。プロダクト名は **JANROKU（ジャンロク）**、ミニマル・ダーク基調。

複数の `DCSection` / `DCArtboard` を含むファイルは各 artboard が小画面のバリエーション（例: `match-list` / `match-detail` / `add-game` / `add-game-tie` / `add-game-mismatch`）。Issue で示された artboard を優先しつつ、関連状態も合わせて実装計画に含める。

### 4. 依存 Issue の状態を確認する

「## 依存」セクションの各 `#M` について:

```bash
gh issue view <M> --json state,title
```

判定:

- 全て `CLOSED` → そのまま進む
- 一部 `OPEN` → ユーザーに「`#M (タイトル)` がまだ open です。依存先なしで進めますか？ あるいは先に #M を着手しますか？」と確認
- 多くが `OPEN`（特に基盤系 #4-#7 が未完で screen 系を着手しようとしている場合）→ 中断推奨

### 5. 計画を立てる

「## 受け入れ基準」の各チェック項目を TaskCreate で TODO 化する。実装中に状態を更新する。

加えて以下を最初の TODO に含めるとよい:
- ブランチ作成
- （実装系で apps/web がまだ無い場合）スキャフォールド完了確認
- 検証コマンド（typecheck / biome / vitest）
- コミット + PR 作成

### 6. ブランチを切る

#### 6a. ベースブランチの決定（main が古くないか確認）

`main` から素直に切る前に、**ローカルに未 push の関連ブランチがないか** 確認する。単一開発者リポでは「直近の作業は別の feat ブランチに乗ったままで origin/main に届いていない」ことが頻繁に起きる。

```bash
git fetch origin
git log --branches --not --remotes --oneline   # ローカルにしかない commit を一覧
```

判定:

- 出力が空 → `main` から切って OK
- 関連しそうな commit がある（例: 同じ `docs/` 配下を触っている、依存 Issue を含む）→ ユーザーに「以下のローカル commit があります。spec-alignment 系ならこれを取り込むべきです:」と一覧を提示し、次のどれにするか確認:
  1. **そのまま main から切る**（差分は後で merge 時に reconcile）
  2. **当該ローカル feat ブランチに rebase する**（stack 構造）
  3. **当該ローカル feat ブランチを先に push & PR & merge してから main から切る**

「base が古くて参照ファイルが見つからない」が後から発覚すると、すでに書いた変更を捨てるか rebase するか判断が要る。先に確認する方が安い。

#### 6b. ブランチ作成

```bash
git switch <chosen-base> && git pull --ff-only && \
git switch -c <prefix>/issue-<N>-<short-slug>
```

`<short-slug>` は Issue タイトルを小文字 kebab-case で 3-5 単語に縮めたもの:

| Issue 例 | slug |
|---|---|
| `Screen: S1 ログイン (Login.html)` | `s1-login` |
| `Infra: apps/web スキャフォールド ...` | `apps-web-scaffold` |
| `Domain: ポイント計算 / 順位 / Ruleset 解決 / 整合性検証` | `domain-scoring` |
| `Spec: ドキュメント / デザイン差分の解消` | `spec-doc-design-alignment` |

ブランチ命名の prefix は label に対応させてもよい（`feat/` `chore/` `docs/`）。迷ったら `feat/`。

### 7. 実装

ラベル別の指針:

#### infra
- `docs/docs/05-tech-stack.md` の方針に沿う
- 既存の `pnpm-workspace.yaml` を尊重しつつ `apps/*` を追加
- バージョンは pin（`^` を避ける）

#### domain
- まず Vitest テストを書く（`tdd` スキルが利用可能なら呼ぶ）
- 計算ロジックは純粋関数で `apps/web/src/domain/` に置く
- `02-domain-model.md` の計算式と整合性制約を Vitest で網羅

#### screen / public
- `react-component` スキルが利用可能なら呼ぶ
- デザイン jsx の構造をそのまま写すのではなく、Tailwind + shadcn/ui（または採用済みのスタイル基盤）で書き直す
- モバイル 375pt を基準。Tailwind の `sm:` 以上は後回しでよい
- 実装後、`pnpm --filter web dev` を起動して目視確認できる場合は確認する。確認できない場合は「目視確認は未実施」と PR body に明記する

#### spec
- コード変更ではなく `docs/docs/0*.md` の編集が主
- 「決定が必要な論点」が Issue body に並んでいる。AskUserQuestion で順に確認する。**選択肢に当てはまらない自由回答が来る可能性に備え、回答を即座にパースし、形式や数が選択肢と合わない場合はその場で clarify する**。重要な数値（ウマ配分など）は最初から自由入力で聞く方が摩擦が少ない。
- 影響を受ける Issue の body は **更新不要**。PR body の Summary に決定事項を網羅し、`Closes #N` で本 Issue を閉じることで、影響 Issue 側からは PR 経由で決定を辿れる。Issue body の二重管理は避ける。
- Docusaurus 3 では autolink `<https://...>` が JSX 解釈されるため bare URL を使う
- `feat/doc-tech` のようなローカル feat ブランチに未マージの doc が乗っている場合、そこに無い doc は本 PR では編集できない。PR body に「<file> は別ブランチ上にしか無いため別途調整が必要」と明示する

### 8. 検証

`apps/web` が存在する場合のみ:

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec biome ci .
pnpm --filter web exec vitest run
```

docs だけの変更（spec ラベル）の場合:

```bash
pnpm --filter docs exec docusaurus build
```

失敗したら直す。3 回試して直らなければ状況をユーザーに報告して指示を仰ぐ。

### 9. コミット

`conventional-commits` スキルに従う。type の選び方:

| ラベル / 内容 | type |
|---|---|
| `screen` / `public` / 新機能 | `feat` |
| `infra` のセットアップ | `chore` |
| `domain` のロジック追加 | `feat` |
| `domain` のリファクタ | `refactor` |
| `spec` (doc 編集) | `docs` |
| バグ修正 | `fix` |

コミットメッセージの footer に `Refs #<N>` を入れる（マージは PR で行うため `Closes` ではなく `Refs`）。

### 10. PR 作成

`pr-create` スキルに従う。body に `Closes #<N>` を含めて PR マージ時に Issue が自動クローズされるようにする。Test plan は受け入れ基準のチェックリストを流用してよい。

### 11. ユーザーに報告

- PR の URL
- 達成した受け入れ基準（チェック済みのもの）
- 残った受け入れ基準（未完があれば明記）
- 依存未完で進めた場合の影響

### 12. （オプション）レビュー → マージへ連鎖

ユーザーの最初の発話に「マージまで」「PR まで」「レビューしてマージ」などの merge 指示が含まれていた場合、続けて `do-pr-review` スキルの手順を実行する。指示が無ければここで停止し、PR をレビュー / merge するかはユーザーの判断に委ねる。

## Issue への進捗コメント

ワークフロー実行中、節目および気づきを `gh issue comment <N> --body "..."` で Issue にコメントとして残す。目的は Issue を「現場の作業ログ」にして、`issue-buster` などから複数 Iteration で回されたときに後追いできる状態を保つこと。

### コメントするタイミング

| タイミング | コメント内容（例） |
|---|---|
| 着手時（ブランチ作成直後） | 「着手します。ブランチ: `<branch>` / ベース: `<base>`」 |
| 想定外の気づき | 仕様・実装上の判断点、ドキュメントとの差分、依存 Issue との関係で気づいたこと |
| 方針の途中変更 | 当初の計画から外れた理由と新しい方針 |
| 検証失敗 / 3 回試行で諦めた時 | 失敗内容（コマンドとエラー要約）と次のアクション |
| ユーザー判断を仰ぐとき | 質問内容と選択肢（AskUserQuestion を投げる直前） |
| PR 作成完了時 | PR URL と、達成した／残った受け入れ基準 |

### 書き方の指針

- **1 コメント 1 トピック**。長文の作業ログを 1 投にまとめない
- 「何をしたか」より「なぜそうしたか / 何に気づいたか」を優先する。コードや diff は PR 側に残るので Issue には載せない
- Iteration 1 件あたり 2〜4 コメントが目安。やったこと全部を逐次書き出すのは過剰
- コードブロックや表は最小限。Issue ページで読みやすい長さに留める
- 機微情報（トークン、内部 URL、未公開資料の中身）は載せない

### コメント不要なケース

- 単純な lint/typecheck 修正のような自明な作業
- すでに PR body / コミットメッセージに同じ情報が載っている場合（重複させない）

## エッジケース

| 状況 | 対処 |
|---|---|
| Issue が見つからない / 404 | エラーを報告して終了 |
| Issue が already CLOSED | ユーザーに「再オープンしますか？」と確認 |
| 依存 Issue が複数 OPEN | 「先に #X を着手することを推奨」と提案 |
| 検証が 3 回失敗 | 状況をユーザーに報告（無限にリトライしない） |
| デザイン URL の取得に失敗 | バンドルが期限切れの可能性。ユーザーに新しい URL を求める |
| デザイン jsx が読みづらい / 解釈に迷う | 該当箇所を抜粋してユーザーに確認 |
| ブランチがすでに存在 | `git switch <existing-branch>` で再開を提案 |
| `apps/web` がまだ無い（#4 未完） | infra/domain なら #4 を先に着手することを強く推奨、screen は #4 完了まで保留 |

## トリガー除外

以下では起動しない:

- Issue 番号が含まれない実装依頼（「ログイン画面作って」「Match 一覧を作って」）
- Issue を新規作成する依頼（「Issue 立てて」「Issue 化して」）
- Issue を参照するが作業意図のない発話（「#12 何だっけ？」「#10 の概要見せて」）
- PR レビュー / 既存 PR の修正依頼
- 複数 Issue の一括着手（「#4 から #10 まとめてやって」）— この場合は 1 件ずつ起動する旨をユーザーに伝える
