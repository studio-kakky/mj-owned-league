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
| 表示要素 | メール / パスワード入力欄 |
| 主な操作 | ログイン |
| 遷移先 | 成功時: `/`（ダッシュボード） |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Login.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Login.html |

### S2. 招待受け入れ

| 項目 | 内容 |
|---|---|
| パス | `/invitations/accept/:token` |
| 表示要素 | 招待元 Owner の情報 / メール / パスワード設定欄 |
| 主な操作 | アカウント作成（招待トークン消費） |
| 遷移先 | 成功時: Group 作成画面（S5） |
| 備考 | 公開サインアップは提供しない。本画面はトークンが有効な場合のみ機能する。 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Invite.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Invite.html |

### S3. Owner ダッシュボード

| 項目 | 内容 |
|---|---|
| パス | `/` |
| 表示要素 | 直近の対局 / アクティブな League・Match のサマリ / 自分の Group 一覧（カード） / 未使用の招待件数 |
| 主な操作 | 各 Group / League / Match / 対局入力 / 招待管理への遷移 |
| 備考 | ログイン後の初期遷移先。直近活動を俯瞰するハブ。未認証で `/` にアクセスした場合は `/login` へリダイレクト。 |
| デザイン | （未設計） |

### S4. Group 一覧

| 項目 | 内容 |
|---|---|
| パス | `/groups` |
| 表示要素 | 自分の Group のカード/リスト（Group 名・Player 数・直近対局日・リーグ数） |
| 主な操作 | Group 作成 / Group 詳細へ遷移 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Groups.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Groups.html |

### S5. Group 作成

| 項目 | 内容 |
|---|---|
| パス | `/groups/new` |
| 表示要素 | Group 名入力 |
| 主な操作 | 作成（同時にデフォルト Ruleset を自動生成） |
| 遷移先 | `/groups/:groupId` |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=Groups.html （`group-add` モーダル） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Groups.html |

### S6. Group 詳細

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId` |
| 構成 | タブ切替 |

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

| 項目 | 内容 |
|---|---|
| パス | `/leagues/:leagueId` |
| 表示要素 | League 名・形式・適用 Ruleset / 順位表 / Match 一覧 / 対局履歴 / 公開 URL |
| 主な操作 | Match 作成 / 対局追加 / League 編集 / 公開 URL コピー |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=LeagueList.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=LeagueList.html |
| 備考 | デザインは `LeagueList.html` に「League 一覧 (S7)」として 4 種類のフィルタ別カードと新規作成モーダルを含む。本ドキュメントの「S7 ダッシュボード」とは粒度差があるため、実装フェーズで一覧 / 詳細の分離を判断する。 |

### S8. League 作成

| 項目 | 内容 |
|---|---|
| パス | `/groups/:groupId/leagues/new` |
| 表示要素 | 名前 / 形式 / デフォルト Ruleset 選択 |
| 主な操作 | 作成 |
| 遷移先 | `/leagues/:leagueId` |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=LeagueList.html （`create` モーダル） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=LeagueList.html |

### S9. Match ダッシュボード

| 項目 | 内容 |
|---|---|
| パス | `/matches/:matchId` |
| 表示要素 | Match 名・開催日・メモ・適用 Ruleset / Match 内順位表 / 対局一覧 / 公開 URL |
| 主な操作 | 対局追加 / Match 編集 / 公開 URL コピー |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchList.html （`match-list` / `match-detail` 各 artboard） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchList.html |

### S10. Match 作成

| 項目 | 内容 |
|---|---|
| パス | `/leagues/:leagueId/matches/new` または `/groups/:groupId/matches/new` |
| 表示要素 | 名前 / 開催日（任意）/ メモ（任意）/ デフォルト Ruleset(任意) |
| 主な操作 | 作成 |
| 遷移先 | `/matches/:matchId` |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchCreate.html |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchCreate.html |

### S11. 対局結果入力

| 項目 | 内容 |
|---|---|
| パス | `/games/new`（URL クエリで親 Group / Match / League を指定） |
| 表示要素 | プレイヤー選択（3 or 4 人）/ 素点入力 / 飛び賞チェック / 適用 Ruleset 確認 |
| 主な操作 | 保存（整合性検証）|
| 遷移先 | 成功時: 対局詳細（S13）または親画面 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchList.html （`add-game` / `add-game-tie` / `add-game-mismatch` artboard） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchList.html |
| 備考 | デザインでは Match 詳細内モーダルとして実装されており、独立画面 (`/games/new`) との差分は実装フェーズで判断。 |

### S12. 対局結果編集

| 項目 | 内容 |
|---|---|
| パス | `/games/:gameId/edit` |
| 表示要素 | S11 と同じフォーム、現在値が初期値 |
| 主な操作 | 保存（再計算） / 削除 |
| デザイン | https://claude.ai/design/p/019e0012-e589-7cb5-bc57-6e0e4c8363b8?file=MatchList.html （S11 と同じモーダル） |
| デザイン (Claude) | https://api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=MatchList.html |

### S13. 対局詳細

| 項目 | 内容 |
|---|---|
| パス | `/games/:gameId` |
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
| 備考 | 全 Owner 画面で共有するシェル。実装時はレイアウトコンポーネントとして抽出する想定。 |

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
| `/groups`, `/leagues`, `/matches`, `/games`, `/invitations` | Owner 用各機能 | 要 |
| `/invitations/accept/:token` | 招待受け入れ | 不要（トークン検証） |
| `/l/:publicSlug` | League 公開ビュー | 不要 |
| `/m/:publicSlug` | Match 公開ビュー（League 外） | 不要 |

---

## 画面遷移マップ（主要動線）

```
Owner:
  [S1 Login] / [S2 招待受け入れ → 新規アカウント作成]
       ↓
  [S3 Owner ダッシュボード `/`]
       ├→ [S4 Group 一覧] ─── [S5 Group 作成]
       │       ↓
       │   [S6 Group 詳細]
       │       ├→ [S8 League 作成] → [S7 League ダッシュボード]
       │       │                          ├→ [S10 Match 作成] → [S9 Match ダッシュボード]
       │       │                          │                          └→ [S11 対局入力] → [S13 対局詳細]
       │       │                          └→ [S11 対局入力 (League 直下)]
       │       ├→ [S10 Match 作成 (League 外)] → [S9 Match ダッシュボード]
       │       └→ [S11 対局入力 (Group 直下カジュアル)]
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
| 認証方式 | メール + パスワード、**招待制**（公開サインアップなし。OAuth は後続） |
| 招待トークンの有効期限 | 仮: 7 日（実装フェーズで調整） |
| 招待数の上限 | 仮: 制限なし（運用で問題あれば後で制限導入） |
| Group 切り替え UI | 共通ヘッダーに Group セレクタを置く想定（実装時確定） |
| モバイル対応 | レスポンシブ前提（ネイティブアプリは対象外） |
| ダッシュボード表示期間の絞り込み | 全期間 / 直近 N 日 / リーグ単位 など、UI で切替可能にするかは未決 |
| Group 直下カジュアル対局の閲覧 UI | Owner ダッシュボード内のみ（公開ページなし）|
| Owner 用個人成績ページ | S6 のサブビューで提供（独立画面にするかは実装フェーズで判断）|
| League 外 Match の個人成績公開ページ | MVP 対象外（必要に応じて後続で追加）|
