---
sidebar_position: 4
---

# 画面一覧

このアプリで提供するすべての画面（ページ）を網羅する。各画面の細かい UI レイアウト・ワイヤーフレームは別途検討。ここでは「何の画面が、誰向けに、どこにあって、何を表示・操作するか」を定義する。

:::info デザイン
ハイファイデザインのカンバス（Claude Design）: https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8

プロダクト名は **JANROKU（ジャンロク）**、ミニマル・ダーク基調・モバイル中心で iteration 済み。
:::

## 区分

- **Owner 用画面** — 要認証（ルート `/` を含む）
- **公開閲覧画面** (`/l/...`, `/m/...`) — 認証不要
- **共通画面** (`/login` など)

---

## Owner 用画面（要認証）

### S1. ログイン

| 項目 | 内容 |
|---|---|
| パス | `/login` |
| 表示要素 | プロダクトロゴ（JANROKU）/ 「Google で続ける」ボタン / 招待制注記 / 利用規約・プライバシーポリシーへのリンク |
| 主な操作 | Google OAuth でサインイン |
| 遷移先 | 成功時: `/`（ダッシュボード） |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Login.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Login.html |

### S2. 招待受け入れ

| 項目 | 内容 |
|---|---|
| パス | `/invitations/accept/:token` |
| 表示要素 | 招待元 Owner の情報 / 「Google で承諾」ボタン |
| 主な操作 | Google OAuth でアカウント作成（招待トークン消費） |
| 遷移先 | 成功時: Group 作成画面（S5） |
| 備考 | 公開サインアップは提供しない。本画面はトークンが有効な場合のみ機能する。 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Invite.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Invite.html |

### S3. Owner ダッシュボード

| 項目 | 内容 |
|---|---|
| パス | （現状未配線。`/` は `/groups` へリダイレクト） |
| 表示要素 | 直近の対局 / アクティブな League・Match のサマリ / 自分の Group 一覧（カード） / 未使用の招待件数 |
| 主な操作 | 各 Group / League / Match / 対局入力 / 招待管理への遷移 |
| 備考 | 全体（横断）ダッシュボード。ログイン後の初期遷移先は **S4 グループ選択（`/groups`）** に変更され、グループ選択後は当該グループの **S6 グループホーム** をホームとして使う（Issue #58）。`/` は `/groups` へリダイレクトし、本画面は現状未参照（コンポーネント自体は削除せず温存）。未認証で `/` にアクセスした場合は `/login` へリダイレクト。 |
| デザイン | （未設計） |

### S4. Group 一覧

| 項目 | 内容 |
|---|---|
| パス | `/groups` |
| 表示要素 | 自分の Group のカード/リスト（Group 名・Player 数・直近対局日・リーグ数） |
| 主な操作 | Group 作成 / Group 選択（カードから「グループに入る」） |
| 遷移先 | Group 選択時: 当該 Group をアクティブグループとして保存（`owners.activeGroupId`）し `/groups/:groupId`（S6）へ遷移 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Groups.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Groups.html |
| 備考 | ログイン後の初期遷移先（グループ選択画面）。この画面ではボトムナビを非表示にする（Issue #58）。 |

### S5. Group 作成

| 項目 | 内容 |
|---|---|
| パス | S4 内のモーダル（独立ページなし） |
| 表示要素 | Group 名入力 |
| 主な操作 | 作成（同時にデフォルト Ruleset を自動生成） |
| 遷移先 | `/groups/:groupId` |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Groups.html （`group-add` モーダル） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Groups.html |
| 備考 | デザイン上は S4 一覧画面の右上「+」から開くモーダル。`/groups/new` のような独立ルートは作らない。 |

### S6. Group 詳細（ホーム）

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId` |
| 表示要素 | Group 通算成績 / 直近対局 / アクティブな League・Match のサマリ / League 一覧と Match 一覧へのリンク |
| 主な操作 | League 一覧（S15）/ Match 作成（S10）/ 対局追加 / Settings（S16）への遷移 |
| 備考 | プレイヤー管理 / Ruleset 管理は Settings 画面（S16）に分離した。本画面は俯瞰ハブとして機能する。**グループ選択後のホーム（ダッシュボード）**であり、ボトムナビの「ホーム」はここを指す（Issue #58）。グループ一覧への「一覧へ」リンクは廃止し、グループ切替はヘッダーのグループスイッチャーに統一した。ルートはファイル名 `groups_.$groupId`（末尾アンダースコア）で S4 一覧ルートから un-nest しており、`/groups`（一覧）とは独立したページとして描画される。 |

タブ:

- **概要** — Group 通算成績・直近対局・League / Match 一覧
- **プレイヤー管理** — Player 一覧（追加・編集・非アクティブ化・削除）。Player 名をクリックで個人成績サブビューを表示
- **Ruleset 管理** — Ruleset 一覧（追加・編集・デフォルト切替）

導線: League 作成 / Match 作成 / 対局追加へのリンクを概要タブから提供。

デザイン:

- 概要タブ: https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=GroupHome.html / Claude: https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=GroupHome.html
- プレイヤー管理 / Ruleset 管理 タブ: https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Settings.html / Claude: https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Settings.html

備考: デザインでは Settings を独立ナビ項目として扱う構成になっている（タブ統合 vs 独立画面の最終形は実装フェーズで判断）。

### S7. League ダッシュボード
### S7. League 詳細

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/leagues/:leagueId` |
| 表示要素 | League 名・形式・適用 Ruleset / 順位表 / Match 一覧 / 対局履歴 / 公開 URL |
| 主な操作 | Match 作成 / 対局追加 / League 編集 / 公開 URL コピー |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=LeagueList.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=LeagueList.html |
| 備考 | デザインは `LeagueList.html` に「League 一覧 (S7)」として 4 種類のフィルタ別カードと新規作成モーダルを含む。一覧は S15（`/groups/:groupId/leagues`）、詳細は本画面（`/groups/:groupId/leagues/:leagueId`）として分離済み（Issue #60）。旧 `/leagues`・`/leagues/:leagueId` はアクティブグループの一覧へリダイレクトする後方互換スタブ。 |

### S8. League 作成

| 項目 | 内容 |
|---|---|
| パス | S15 内のモーダル（独立ページなし） |
| 表示要素 | 名前 / 形式 / デフォルト Ruleset 選択（Group はパスの `:groupId` に固定。ドロップダウンは当該 Group の単一選択肢に縮退） |
| 主な操作 | 作成 |
| 遷移先 | `/groups/:groupId/leagues/:leagueId` |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=LeagueList.html （`create` モーダル） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=LeagueList.html |

### S9. Match ダッシュボード

| 項目 | 内容 |
|---|---|
| パス | 一覧 `/groups/:groupId/matches`（`?leagueId=` で同一グループ内リーグに絞り込み）/ 詳細 `/groups/:groupId/matches/:matchId` |
| 表示要素 | Match 名・開催日・メモ・適用 Ruleset / Match 内順位表 / 対局一覧 / 公開 URL |
| 主な操作 | 対局追加 / Match 編集 / 公開 URL コピー |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchList.html （`match-list` / `match-detail` 各 artboard） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchList.html |
| 備考 | 一覧・作成・詳細はすべて Group 配下に統一（Issue #61）。`groupId` は URL パス起点で、横断（全グループ）一覧は廃止。`?leagueId=` は当該グループ内のリーグのみを許容するサーバー検証付き任意フィルタ。旧 `/matches`・`/matches/:matchId` はアクティブグループの一覧へリダイレクトする後方互換スタブ。 |

### S10. Match 作成

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/matches/new`（`?leagueId=` で同一グループ内リーグに事前ピン） |
| 表示要素 | 名前 / 開催日（任意）/ メモ（任意）/ デフォルト Ruleset(任意) |
| 主な操作 | 作成 |
| 遷移先 | `/groups/:groupId/matches/:matchId`（リーグ配下作成時はリーグ詳細へ戻る） |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchCreate.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchCreate.html |
| 備考 | `groupId` は URL パス起点。作成時の Group はクライアント送信値ではなくパスから供給する。旧 `/matches/new` はアクティブグループ（または `?groupId=`）の作成画面へリダイレクト。 |

### S11. 対局結果入力

| 項目 | 内容 |
|---|---|
| パス | S9 Match 詳細内のモーダル（独立ページなし） |
| 表示要素 | プレイヤー選択（3 or 4 人）/ 素点入力 / 飛び賞チェック / 適用 Ruleset 確認 |
| 主な操作 | 保存（整合性検証）|
| 遷移先 | 成功時: 対局詳細（S13）または親画面 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchList.html （`add-game` / `add-game-tie` / `add-game-mismatch` artboard） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchList.html |
| 備考 | デザインでは Match 詳細内モーダルとして実装されており、独立画面 (`/games/new`) との差分は実装フェーズで判断。 |

### S12. 対局結果編集

| 項目 | 内容 |
|---|---|
| パス | S9 Match 詳細内のモーダル（独立ページなし） |
| 表示要素 | S11 と同じフォーム、現在値が初期値 |
| 主な操作 | 保存（再計算） / 削除 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchList.html （S11 と同じモーダル） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchList.html |

### S13. 対局詳細

| 項目 | 内容 |
|---|---|
| パス | S9 Match 詳細内の対局リスト行（独立ページなし） |
| 表示要素 | 素点 / ポイント / 順位 / 適用 Ruleset / 飛び賞 |
| 主な操作 | 編集（S12 へ）/ 削除 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchList.html （`match-detail` 内の Game 行） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchList.html |

### S14. 招待管理

| 項目 | 内容 |
|---|---|
| パス | `/invitations` |
| 表示要素 | 自分が発行した招待一覧（送付先メモ / 状態 / 有効期限） |
| 主な操作 | 新規招待発行（招待 URL 生成）/ 招待取消 |
| 備考 | 招待 URL はクリップボードにコピーして手動で共有する（メール自動送信は MVP 対象外） |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Invitations.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Invitations.html |

### S15. League 一覧

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/leagues` |
| 表示要素 | パスの `:groupId` の Group 内 League カード一覧（フィルタ: すべて / 進行中 / 終了）/ 各 League のサマリ（形式・参加人数・対局数・最終対局日）。一覧が単一 Group にスコープされるためカードに Group ラベルは表示しない |
| 主な操作 | League 作成（S8 モーダル）/ League 詳細（S7）への遷移 |
| 備考 | Group 配下に複数 League がある場合の俯瞰画面。`groupId` は URL パスを唯一の入力源とし、`?groupId=` クエリや横断フォールバックは持たない。他人 / 不明な `groupId` はサーバー側の所有権検証で弾き `/groups` へリダイレクト（Issue #60）。ボトムナビの「リーグ」はアクティブグループの本一覧（`/groups/:activeGroupId/leagues`）を指す。 |

### S16. Settings（プレイヤー / Ruleset 管理）

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/settings` |
| 表示要素 | 設定トップ → Ruleset テンプレート管理 / Player 管理 のサブセクション |
| 主な操作 | Ruleset の追加・編集・削除・デフォルト切替 / Player の追加・編集・非アクティブ化・削除 |
| 備考 | S6 のタブから独立した画面に切り出した。履歴ありの Player は「削除不可 → 非アクティブ化提案」を表示する。 |

---

## 公開閲覧画面（認証不要）

### P1. League 公開ページ

| 項目 | 内容 |
|---|---|
| パス | `/l/:publicSlug` |
| 表示要素 | League 概要 / 順位表 / Match 一覧 / 対局履歴 |
| 操作 | Match 公開ページ（P2）/ 個人成績ページ（P4）への遷移 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Public.html （`public-league`） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Public.html |

### P2. Match 公開ページ（League 配下）

| 項目 | 内容 |
|---|---|
| パス | `/l/:publicSlug/matches/:sequenceNumber` |
| 表示要素 | Match 概要 / Match 内順位表 / 対局履歴 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Public.html （`public-match-list` / `public-match`） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Public.html |

### P3. Match 公開ページ（League 外）

| 項目 | 内容 |
|---|---|
| パス | `/m/:publicSlug` |
| 表示要素 | Match 概要 / 順位表 / 対局履歴 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Public.html （`public-match` を流用） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Public.html |

### P4. 個人成績ページ（League 内）

| 項目 | 内容 |
|---|---|
| パス | `/l/:publicSlug/players/:playerId` |
| 表示要素 | プレイヤー名 / League 内の集計指標 / Match 別の成績テーブル / 対局履歴（League 内） |
| 操作 | 各 Match 公開ページ（P2）への遷移 |
| 備考 | League の順位表のプレイヤー名から遷移する。 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Public.html （`public-ranking` を起点に個人ビューを派生） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Public.html |

---

## デザインのみの追加要素（S/P 未割当）

デザインバンドルに含まれるが、本書の S/P 番号に紐付いていないもの。実装フェーズで採用 / 分解の判断をする。

### マッチ一覧（グループ横断）

| 項目 | 内容 |
|---|---|
| 役割 | リーグ横断でマッチを一覧 / 絞り込み（リーグセレクタによるフィルタ 3 種） |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchListAll.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchListAll.html |
| 備考 | S9 のサブビュー化 / 独立画面化は実装時に判断。 |

### 共通ヘッダー / フッター

| 項目 | 内容 |
|---|---|
| 役割 | ホーム / リーグ / マッチ / 設定のナビ + グループ切替シート |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Header_Footer.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Header_Footer.html |
| 備考 | 全 Owner 画面で共有するシェル（`OwnerShell`）。**ボトムナビはグループ選択後のページでのみ表示**し、グループ選択画面（S4 `/groups`）では非表示にする（ナビの遷移先がアクティブグループ前提のため）。ナビの「ホーム」はトップレベル `/` ではなく、**選択中グループの S6 ダッシュボード（`/groups/:groupId`）** を指す。グループ切替はヘッダーのグループスイッチャー（`GroupSwitcherSheet`）から行う（Issue #58）。 |

---

## 共通・その他

| 画面 | パス | 用途 |
|---|---|---|
| 404 | (任意) | 存在しないリソースへのアクセス |
| エラー画面 | (任意) | 想定外エラー時 |
| 認証期限切れ | (リダイレクト) | `/login` へ誘導 |

---

## URL 名前空間の整理

ルート直下の各セグメントを次のように使い分ける。Owner 用画面と公開閲覧画面で名前空間がぶつからないよう設計している。

| プレフィックス | 用途 | 認証 |
|---|---|---|
| `/` | Owner ダッシュボード | 要 |
| `/login` | ログイン | 不要 |
| `/groups`, `/groups/:groupId`, `/groups/:groupId/leagues`, `/groups/:groupId/leagues/:leagueId`, `/groups/:groupId/matches`, `/groups/:groupId/matches/new`, `/groups/:groupId/matches/:matchId`, `/groups/:groupId/settings`, `/invitations` | Owner 用各機能（リーグ・マッチとも Group 配下に統一、Issue #60 / #61） | 要 |
| `/leagues`, `/leagues/:leagueId`, `/matches`, `/matches/new`, `/matches/:matchId` | 後方互換リダイレクト（アクティブグループの `/groups/:groupId/...` へ。アクティブグループ未選択時は `/groups` へ） | 要 |
| `/invitations/accept/:token` | 招待受け入れ | 不要（トークン検証） |
| `/l/:publicSlug` | League 公開ビュー | 不要 |
| `/m/:publicSlug` | Match 公開ビュー（League 外） | 不要 |

`/games/*` は使わない。対局の作成 / 編集 / 詳細はすべて S9 Match 詳細内のモーダル + 対局リスト行で扱う。

---

## 画面遷移マップ（主要動線）

```
Owner:
  [S1 Login (Google OAuth)] / [S2 招待受け入れ (Google OAuth)]
       ↓
  [S3 Owner ダッシュボード `/`]
       ├→ [S4 Group 一覧] ─── [S5 Group 作成 (モーダル)]
       │       ↓
       │   [S6 Group 詳細 (ホーム)]
       │       ├→ [S15 League 一覧] ─── [S8 League 作成 (モーダル)]
       │       │       ↓
       │       │   [S7 League 詳細]
       │       │       ├→ [S10 Match 作成] → [S9 Match 詳細]
       │       │       │                          └→ [S11/S12/S13 対局 CRUD (モーダル & インライン)]
       │       │       └→ [S9 Match 詳細 (既存)]
       │       ├→ [S10 Match 作成 (League 外)] → [S9 Match 詳細]
       │       └→ [S16 Settings (Player / Ruleset 管理)]
       └→ [S14 招待管理]

Viewer:
  [P1 League 公開] ──┬→ [P2 Match 公開 (League 配下)]
                     └→ [P4 個人成績 (League 内)]
  [P3 Match 公開 (League 外)]
```

---

## 仮置き事項

| 論点 | 仮置きの方針 |
|---|---|
| 招待トークンの有効期限 | 仮: 7 日（実装フェーズで調整） |
| 招待数の上限 | 仮: 制限なし（運用で問題あれば後で制限導入） |
| Group 切り替え UI | 共通ヘッダーに Group セレクタを置く想定（実装時確定） |
| モバイル対応 | レスポンシブ前提（ネイティブアプリは対象外） |
| ダッシュボード表示期間の絞り込み | 全期間 / 直近 N 日 / リーグ単位 など、UI で切替可能にするかは未決 |
| Group 直下カジュアル対局の閲覧 UI | Owner ダッシュボード内のみ（公開ページなし）|
| Owner 用個人成績ページ | S16 Settings の Player サブセクションで提供（独立画面にするかは実装フェーズで判断）|
| League 外 Match の個人成績公開ページ | MVP 対象外（必要に応じて後続で追加）|
