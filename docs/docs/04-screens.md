---
sidebar_position: 4
---

# 画面一覧

このアプリで提供するすべての画面（ページ）を網羅する。各画面の細かい UI レイアウト・ワイヤーフレームは別途検討。ここでは「何の画面が、誰向けに、どこにあって、何を表示・操作するか」を定義する。

## 全体方針

- **Group コンテキスト中心**。Owner 用画面は常に「いずれかの Group が選択されている」状態を前提とする。
- **横断ダッシュボードは持たない**。ログイン後はいきなり Group ホームに着地する。
- **共通ヘッダーに Group セレクタ**を配置し、所属する複数 Group をいつでも切替可能。
- Owner 用 URL は原則 `/groups/:groupId/...` の配下にネストする（招待など Owner 単位の機能のみ例外）。
- ルート `/` は「最後に選択した Group のホーム」へリダイレクト。Group 0 個（招待受諾直後）の場合は `/groups/new` へ。
- **Group 配下の管理機能は Group 設定（S4）に集約**。Player 管理・Ruleset 管理・基本設定をタブ（サブパス）で切替える。

## 区分

- **Owner 用画面** — 要認証
- **公開閲覧画面** (`/l/...`, `/m/...`) — 認証不要
- **共通画面** (`/login`, `/invitations/accept/:token` など)

---

## 共通レイアウト（Owner 用画面）

| 領域 | 内容 |
|---|---|
| ヘッダー | アプリ名 / **Group セレクタ**（現在の Group 表示・切替・新規作成への導線）/ 招待管理リンク / アカウントメニュー |
| メイン | 各画面の本体 |
| パンくず | `Group 名 > League 名 > Match 名 > ...` の階層を示す |

Group セレクタからの遷移先は常に「その Group のホーム（S3）」。

---

## Owner 用画面（要認証）

### S1. ログイン

| 項目 | 内容 |
|---|---|
| パス | `/login` |
| 表示要素 | メール / パスワード入力欄 |
| 主な操作 | ログイン |
| 遷移先 | 成功時: `/`（最後に選択した Group のホーム、または Group 作成へリダイレクト） |

### S2. 招待受け入れ

| 項目 | 内容 |
|---|---|
| パス | `/invitations/accept/:token` |
| 表示要素 | 招待元 Owner の情報 / メール / パスワード設定欄 |
| 主な操作 | アカウント作成（招待トークン消費） |
| 遷移先 | 成功時: `/groups/new`（Group 作成画面） |
| 備考 | 公開サインアップは提供しない。本画面はトークンが有効な場合のみ機能する。 |

### S3. Group ホーム

ログイン後の実質的なトップ画面。タブを持たず、1 画面に主要セクションを縦に並置する。

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId` |
| 表示要素 | Group 名 / 通算成績サマリ / **League 一覧セクション**（直近・主要を抜粋）/ **Match 一覧セクション**（League 紐付けの有無を問わない一覧）/ 直近の対局 / 各種管理画面・対局入力への導線 |
| 主な操作 | League 作成 / Match 作成 / 対局追加 / League 一覧（S6）/ Group 設定（S4: Player・Ruleset・基本設定）への遷移 |
| 備考 | League 一覧と Match 一覧は別セクションで縦並び。タブ切替は使わない。リーグ数が多い場合は「すべて見る」で S6 League 一覧へ。 |

### S4. Group 設定

Group 配下の管理機能を集約するハブ画面。基本設定 / Player 管理 / Ruleset 管理 をタブ（サブパス）で切替える。

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/settings`（基本タブ） |
| 構成 | タブ切替（サブパスを持つ） |

#### S4-a. 基本タブ

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/settings` |
| 表示要素 | Group 名編集 / Group 削除（対局がない場合のみ） |
| 主な操作 | Group 編集 / 削除 |

#### S4-b. Player 管理タブ

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/settings/players` |
| 表示要素 | Player 一覧（名前 / アクティブ状態 / 対局数）/ 個別 Player の集計サブビュー |
| 主な操作 | Player 追加 / 編集 / 非アクティブ化 / 削除（対局履歴がない場合のみ） |

#### S4-c. Ruleset 管理タブ

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/settings/rulesets` |
| 表示要素 | Ruleset 一覧（名前 / 配給原点 / 原点 / ウマ / 飛び賞）/ Group デフォルト指定 |
| 主な操作 | Ruleset 追加 / 編集 / Group デフォルトの切替 |
| 備考 | Ruleset は **テンプレート** であり、League / Match / Game 作成時のフォーム初期値として使われる。テンプレートを後から編集しても、既存の League / Match / Game のルールには影響しない（各エンティティがルール値をデータとして保持するため）。 |

### S5. Group 作成

| 項目 | 内容 |
|---|---|
| パス | `/groups/new` |
| 表示要素 | Group 名入力 |
| 主な操作 | 作成（同時にデフォルト Ruleset テンプレートを自動生成） |
| 遷移先 | `/groups/:groupId`（S3） |
| 備考 | 招待受諾直後・Group を持たない Owner が `/` にアクセスした場合の誘導先でもある。 |

### S6. League 一覧

Group 配下の全 League を俯瞰する画面。Group ホームのセクションは抜粋表示で、こちらは完全な一覧。

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/leagues` |
| 表示要素 | League 一覧（名前 / 形式 / Match 数 / 対局数 / 直近対局日 / 状態など）/ 検索・フィルタ（実装時確定） |
| 主な操作 | League 作成（S7 へ）/ 個別 League ダッシュボード（S8）への遷移 |
| 備考 | Group ホームの League 一覧セクションから「すべて見る」で本画面へ遷移。 |

### S7. League 作成

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/leagues/new` |
| 表示要素 | 名前 / 形式 / **ルール値**（配給原点 / 原点 / ウマ / 飛び賞）— Ruleset テンプレートから初期値を読み込み、必要なら個別に編集 |
| 主な操作 | 作成（ルール値は League 自身のデータとして保存） |
| 遷移先 | `/groups/:groupId/leagues/:leagueId`（S8） |
| 備考 | Ruleset テンプレートを選択すると、その値がフォームにコピーされる。保存後の League は選んだ Ruleset と独立し、テンプレートを編集してもこの League には反映されない。 |

### S8. League ダッシュボード

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/leagues/:leagueId` |
| 表示要素 | League 名・形式・**League のルール値（埋め込みデータ）** / 順位表 / Match 一覧 / 対局履歴 / 公開 URL |
| 主な操作 | Match 作成 / 対局追加 / League 編集（ルール値の編集を含む）/ 公開 URL コピー |

### S9. Match ダッシュボード

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/matches/:matchId` |
| 表示要素 | Match 名・開催日・メモ・**Match のルール値（埋め込みデータ）** / Match 内順位表 / 対局一覧 / 公開 URL |
| 主な操作 | 対局追加 / Match 編集（ルール値の編集を含む）/ 公開 URL コピー |
| 備考 | URL は League 配下・League 外を問わず一律 `/groups/:groupId/matches/:matchId`。所属 League の表示はパンくずで示す。 |

### S10. Match 作成

| 項目 | 内容 |
|---|---|
| パス | League 配下: `/groups/:groupId/leagues/:leagueId/matches/new` / League 外: `/groups/:groupId/matches/new` |
| 表示要素 | 名前 / 開催日（任意）/ メモ（任意）/ **ルール値**（League 配下なら親 League のルール、League 外なら Group デフォルト Ruleset から初期値） |
| 主な操作 | 作成（ルール値は Match 自身のデータとして保存） |
| 遷移先 | `/groups/:groupId/matches/:matchId`（S9） |
| 備考 | Ruleset テンプレートの選択でフォーム値を上書き可能。保存後は Match 自身のデータとして独立する。 |

### S11. 対局結果入力

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/games/new`（URL クエリで親 Match / League を指定可） |
| 表示要素 | プレイヤー選択（3 or 4 人）/ 素点入力 / 飛び賞チェック / **適用ルール値**（親 Match → 親 League → Group デフォルトの順で初期化、編集可） |
| 主な操作 | 保存（整合性検証） |
| 遷移先 | 成功時: 対局詳細（S13）または親画面 |
| 備考 | 保存時、その Game に適用されたルール値はスナップショットとして Game 自身に保存される。あとから親 Match / League のルールを変更しても、過去 Game の計算結果は変わらない。 |

### S12. 対局結果編集

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/games/:gameId/edit` |
| 表示要素 | S11 と同じフォーム、現在値が初期値（その Game に保存されたルール値スナップショットを含む） |
| 主な操作 | 保存（再計算）/ 削除 |

### S13. 対局詳細

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/games/:gameId` |
| 表示要素 | 素点 / ポイント / 順位 / 飛び賞 / **適用されたルール値（Game 埋め込みのスナップショット）** |
| 主な操作 | 編集（S12 へ）/ 削除 |

### S14. 招待管理

| 項目 | 内容 |
|---|---|
| パス | `/invitations` |
| 表示要素 | 自分が発行した招待一覧（送付先メモ / 状態 / 有効期限） |
| 主な操作 | 新規招待発行（招待 URL 生成）/ 招待取消 |
| 備考 | 招待は Owner 単位の機能のため Group 配下に置かない。招待 URL はクリップボードにコピーして手動共有（メール自動送信は MVP 外）。 |

---

## 公開閲覧画面（認証不要）

公開閲覧側は Group コンテキストを露出しない。`publicSlug` で対象を特定する。

### P1. League 公開ページ

| 項目 | 内容 |
|---|---|
| パス | `/l/:publicSlug` |
| 表示要素 | League 概要（ルール値含む） / 順位表 / Match 一覧 / 対局履歴 |
| 操作 | Match 公開ページ（P2）/ 個人成績ページ（P4）への遷移 |

### P2. Match 公開ページ（League 配下）

| 項目 | 内容 |
|---|---|
| パス | `/l/:publicSlug/matches/:sequenceNumber` |
| 表示要素 | Match 概要（ルール値含む） / Match 内順位表 / 対局履歴 |

### P3. Match 公開ページ（League 外）

| 項目 | 内容 |
|---|---|
| パス | `/m/:publicSlug` |
| 表示要素 | Match 概要（ルール値含む） / 順位表 / 対局履歴 |

### P4. 個人成績ページ（League 内）

| 項目 | 内容 |
|---|---|
| パス | `/l/:publicSlug/players/:playerId` |
| 表示要素 | プレイヤー名 / League 内の集計指標 / Match 別の成績テーブル / 対局履歴（League 内） |
| 操作 | 各 Match 公開ページ（P2）への遷移 |
| 備考 | League の順位表のプレイヤー名から遷移する。 |

---

## 共通・その他

| 画面 | パス | 用途 |
|---|---|---|
| ルートリダイレクト | `/` | 最後に選択した Group のホームへリダイレクト。Group 0 個なら `/groups/new` |
| 404 | (任意) | 存在しないリソースへのアクセス |
| エラー画面 | (任意) | 想定外エラー時 |
| 認証期限切れ | (リダイレクト) | `/login` へ誘導 |

---

## URL 名前空間の整理

| プレフィックス | 用途 | 認証 |
|---|---|---|
| `/` | ルートリダイレクト（最後に選択した Group のホーム） | 要 |
| `/login` | ログイン | 不要 |
| `/groups/new` | Group 作成 | 要 |
| `/groups/:groupId` | Group ホーム | 要 |
| `/groups/:groupId/settings` | Group 設定（基本タブ） | 要 |
| `/groups/:groupId/settings/players` | Group 設定（Player 管理タブ） | 要 |
| `/groups/:groupId/settings/rulesets` | Group 設定（Ruleset 管理タブ） | 要 |
| `/groups/:groupId/leagues` | League 一覧 | 要 |
| `/groups/:groupId/leagues/new` | League 作成 | 要 |
| `/groups/:groupId/leagues/:leagueId` | League ダッシュボード | 要 |
| `/groups/:groupId/leagues/:leagueId/matches/new` | Match 作成（League 配下） | 要 |
| `/groups/:groupId/matches/new` | Match 作成（League 外） | 要 |
| `/groups/:groupId/matches/:matchId` | Match ダッシュボード | 要 |
| `/groups/:groupId/games/new` | 対局結果入力 | 要 |
| `/groups/:groupId/games/:gameId` | 対局詳細 | 要 |
| `/groups/:groupId/games/:gameId/edit` | 対局結果編集 | 要 |
| `/invitations` | 招待管理（Owner 単位） | 要 |
| `/invitations/accept/:token` | 招待受け入れ | 不要（トークン検証） |
| `/l/:publicSlug` | League 公開ビュー | 不要 |
| `/m/:publicSlug` | Match 公開ビュー（League 外） | 不要 |

旧設計にあった `/leagues/:leagueId` `/matches/:matchId` `/games/:gameId` などのトップレベル URL は廃止し、すべて `/groups/:groupId/...` の配下に集約する。Player 管理・Ruleset 管理は Group 設定のサブパスに集約する。

---

## 画面遷移マップ（主要動線）

```
Owner:
  [S1 Login] / [S2 招待受け入れ → 新規アカウント作成]
       ↓                              ↓
       ↓                       [S5 Group 作成]
       ↓                              ↓
  [/  → 最後に選択した Group へリダイレクト]
       ↓
  [S3 Group ホーム `/groups/:groupId`]
       ├─ ヘッダー Group セレクタ → 別 Group の S3 へ切替
       ├→ [S4 Group 設定]（タブ: 基本 / Player 管理 / Ruleset 管理）
       ├→ [S6 League 一覧] ─┬→ [S7 League 作成] → [S8 League ダッシュボード]
       │                     └→ [S8 League ダッシュボード]
       │                              ├→ [S10 Match 作成 (League 配下)] → [S9 Match ダッシュボード]
       │                              │                                       └→ [S11 対局入力] → [S13 対局詳細]
       │                              └→ [S11 対局入力 (League 直下)]
       ├→ [S7 League 作成 (Group ホームから直接)] → [S8 League ダッシュボード]
       ├→ [S10 Match 作成 (League 外)] → [S9 Match ダッシュボード]
       ├→ [S11 対局入力 (Group 直下カジュアル)]
       └→ [S14 招待管理 `/invitations`]（ヘッダーから直接遷移）

Viewer:
  [P1 League 公開] ──┬→ [P2 Match 公開 (League 配下)]
                     └→ [P4 個人成績 (League 内)]
  [P3 Match 公開 (League 外)]
```

---

## 仮置き事項

| 論点 | 仮置きの方針 |
|---|---|
| 認証方式 | メール + パスワード、**招待制**（公開サインアップなし。OAuth は後続） |
| 招待トークンの有効期限 | 仮: 7 日（実装フェーズで調整） |
| 招待数の上限 | 仮: 制限なし（運用で問題あれば後で制限導入） |
| Group セレクタ UI | 共通ヘッダーのドロップダウン（実装時に細部確定） |
| 「最後に選択した Group」の保持方法 | サーバ側に Owner ごとの最終選択 Group を保存、なければ最古/最新の Group にフォールバック（実装時確定） |
| Group 設定のタブ間遷移 | サブパス遷移（`/settings`、`/settings/players`、`/settings/rulesets`）。タブ位置は実装時確定 |
| モバイル対応 | レスポンシブ前提（ネイティブアプリは対象外） |
| Group ホームの表示期間絞り込み | 全期間 / 直近 N 日 / リーグ単位 など、UI で切替可能にするかは未決 |
| Group ホームのリーグ抜粋件数 | 何件まで Group ホームに表示し、何件以上で「すべて見る」を出すかは実装フェーズで判断 |
| Group 直下カジュアル対局の閲覧 UI | Group ホームの Match 一覧 / 対局履歴セクション（公開ページなし） |
| Owner 用個人成績ページ | S4-b（Player 管理タブ）のサブビューで提供。独立画面化は実装フェーズで判断 |
| League 外 Match の個人成績公開ページ | MVP 対象外（必要に応じて後続で追加） |
