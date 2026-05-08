---
sidebar_position: 3
---

# 主要ユースケースとフロー

`01-overview.md` のロール（Owner / Viewer / Player）と `02-domain-model.md` のエンティティを前提に、主要なユースケースの流れを整理する。

## ロールと権限

| 操作 | Owner | Viewer |
|---|---|---|
| Group / Player / Ruleset の作成・編集 | ○ | × |
| League / Match / Game の作成・編集・削除 | ○ | × |
| Group ホーム（および Group 配下の管理画面）へのアクセス | ○ | × |
| 招待の発行・取消（他の Owner を招く） | ○ | × |
| 公開 URL からの閲覧（成績・順位） | ○ | ○ |

- Owner も自分のリーグを公開 URL から閲覧可能（同じビューを見ながら共有相手と話せるように）。
- Viewer は URL を知っていれば誰でもアクセスできる。「秘匿」ではなく「推測困難」レベルのアクセス制御（`publicSlug` はランダム文字列）。

## ナビゲーションの基本前提

- Owner 用画面は常に「いずれかの Group が選択されている」状態で動作する。
- Group の切替はすべての Owner 用画面で共通ヘッダーの **Group セレクタ** から行う。
- Owner は複数 Group を持ち得るが、「全 Group 横断の俯瞰画面」は MVP では持たない。

## URL 設計（仮）

### Owner 用（要認証）

| パス | 役割 |
|---|---|
| `/login` | ログイン |
| `/invitations/accept/:token` | 招待受け入れ（新規アカウント作成 / 認証不要） |
| `/` | 最後に選択した Group のホームへリダイレクト（Group 0 個なら `/groups/new`） |
| `/invitations` | 招待管理（Owner 単位） |
| `/groups/new` | Group 作成 |
| `/groups/:groupId` | Group ホーム（League 一覧・Match 一覧・通算成績などを並置） |
| `/groups/:groupId/settings` | Group 設定（基本タブ） |
| `/groups/:groupId/settings/players` | Group 設定（Player 管理タブ） |
| `/groups/:groupId/settings/rulesets` | Group 設定（Ruleset 管理タブ） |
| `/groups/:groupId/leagues` | League 一覧 |
| `/groups/:groupId/leagues/new` | League 作成 |
| `/groups/:groupId/leagues/:leagueId` | League ダッシュボード |
| `/groups/:groupId/matches/new` | Match 作成（League 外） |
| `/groups/:groupId/leagues/:leagueId/matches/new` | Match 作成（League 配下） |
| `/groups/:groupId/matches/:matchId` | Match ダッシュボード（League 配下・League 外問わず） |
| `/groups/:groupId/games/new` | 対局結果入力フォーム（クエリで親 Match / League を指定可） |
| `/groups/:groupId/games/:gameId` | 対局詳細 |
| `/groups/:groupId/games/:gameId/edit` | 対局結果編集 |

トップレベルの `/leagues/...` `/matches/...` `/games/...` は使用しない。Owner 用機能はすべて `/groups/:groupId/...` 配下にネストする（招待関連を除く）。

### 公開閲覧（認証不要）

| パス | 役割 |
|---|---|
| `/l/:publicSlug` | League 公開ページ（成績・順位・Match 一覧） |
| `/l/:publicSlug/matches/:sequenceNumber` | League 配下の Match 公開ページ |
| `/l/:publicSlug/players/:playerId` | League 内の個人成績ページ |
| `/m/:publicSlug` | League 外の Match の公開ページ |

- Group 単位の公開ページは MVP では作らない（必要になったら追加）。
- League 外のカジュアル対局（Group 直下の単発 Game）の公開ページも MVP では作らない。

## 主要フロー

### F1. 初回セットアップ（招待受諾）

公開サインアップは提供しない。新規 Owner は **既存 Owner からの招待** によってのみアカウントを作成できる。

1. 既存 Owner から招待 URL（`/invitations/accept/:token`）を受け取る
2. URL を開き、メールアドレス（任意で固定）/ パスワードを設定 → アカウント作成
3. 自動的にログインし、`/groups/new`（Group 作成画面）に誘導される
4. Group 名を入力して作成
5. Group 作成時、**デフォルト Ruleset** が自動生成される
   - 25000 持ち / 30000 返し / ウマ `UMA_10_30` / 飛び賞なし
6. `/groups/:groupId`（Group ホーム）へ遷移

招待されたユーザーは **独立した Owner** として登録される（招待元の Group には自動で参加しない）。

### F2. ログイン後の着地

1. `/login` でログイン成功
2. サーバ側に保存された「最後に選択した Group」へリダイレクト
   - 該当 Group が存在しない、または Group を 1 つも持たない場合は `/groups/new` へ
   - 複数 Group を持つ場合、ヘッダーの Group セレクタからいつでも切替可能

### F3. プレイヤー登録

1. ヘッダーから現在の Group を確認
2. Group ホーム → 「Group 設定」 → Player 管理タブ（`/groups/:groupId/settings/players`）
3. 「プレイヤーを追加」 → 名前を入力 → 保存
4. Player が `isActive = true` で追加される

### F4. Ruleset テンプレート管理

Ruleset は **テンプレート** であり、League / Match / Game の作成フォームの初期値を提供する。Ruleset を編集しても既存の League / Match / Game のルール値には影響しない（各エンティティが値を埋め込みデータとして保持しているため）。

1. Group ホーム → 「Group 設定」 → Ruleset 管理タブ（`/groups/:groupId/settings/rulesets`）
2. デフォルト Ruleset の編集 or 新規 Ruleset の作成
3. 設定項目: 名前 / 配給原点 / 原点 / ウマパターン / 飛び賞ポイント（`0` なら飛び賞なし、`> 0` なら有効）
4. Group のデフォルト Ruleset を切り替え可能

### F5. League 作成

1. Group ホームのリーグ一覧セクション、または League 一覧（`/groups/:groupId/leagues`）→ 「リーグを作成」 → `/groups/:groupId/leagues/new`
2. 入力項目: 名前 / 形式（`4P_HANCHAN` など）/ デフォルト Ruleset
3. `publicSlug` を自動採番
4. `/groups/:groupId/leagues/:leagueId`（League ダッシュボード）へ遷移

### F6. Match 作成

1. League ダッシュボードまたは Group ホーム → 「Match を作成」
   - League 配下: `/groups/:groupId/leagues/:leagueId/matches/new`
   - League 外: `/groups/:groupId/matches/new`
2. 入力項目: 名前 / 開催日（任意）/ メモ（任意）/ デフォルト Ruleset（任意）
3. League 配下の場合は `sequenceNumber` を自動採番
4. `/groups/:groupId/matches/:matchId`（Match ダッシュボード）へ遷移

### F7. 対局結果入力（Game 作成）

最も頻度が高いフロー。Match ダッシュボード / League ダッシュボード / Group ホームのいずれからでも開始可能。

1. 「対局を追加」 → `/groups/:groupId/games/new`（クエリで親 Match / League を指定）
2. **プレイヤーを選択**（`format` の人数分）
   - Group 内の `isActive = true` な Player から選ぶ
3. **各プレイヤーの素点を入力**
4. 飛び賞 ON の Ruleset の場合、飛ばした人 / 飛んだ人を選択（任意。飛び局でなければ無指定）
5. 適用 Ruleset を確認（デフォルト解決済み。手動変更も可）
6. 「保存」
   - 整合性検証: 素点合計 === `startingScore × 人数`
   - 失敗時はエラー表示、入力画面に戻る
7. 成功時、ポイント・順位が自動計算されて結果画面（`/groups/:groupId/games/:gameId`）に遷移

### F8. 対局結果の修正

1. 対象 Game の詳細ページ（`/groups/:groupId/games/:gameId`） → 「編集」または「削除」
2. 編集の場合、`/groups/:groupId/games/:gameId/edit` で F7 と同じフォームを再入力
3. 保存時にポイント・順位を再計算
4. 削除は物理削除（仮置き。論理削除に切り替える可能性あり）
5. League / Match / Group の集計は再計算済みの値で更新

### F9. URL 共有による閲覧

1. League ダッシュボード（または Match ダッシュボード）→ 「公開 URL をコピー」
2. URL を共有相手に送る
3. 受け取った Viewer がアクセス → 認証なしで成績・順位を閲覧

### F10. プレイヤーの非アクティブ化 / 削除

Player の削除可否は対局履歴の有無で分岐する。

1. `/groups/:groupId/players` → 該当 Player の操作メニュー
2. 操作の選択:
   - **対局履歴あり** の場合: 「非アクティブにする」のみ表示
     - `isActive = false` になる
     - 以後の対局結果入力画面の選択肢から外れる
     - 過去の対局結果・集計には引き続き表示される
   - **対局履歴なし** の場合: 「削除する」も選択可能
     - 物理削除される
     - 削除後は Group のプレイヤー一覧から消える

### F11. Group の切替

1. ヘッダーの Group セレクタを開く
2. 切替先の Group を選択
3. その Group のホーム（`/groups/:groupId`）へ遷移
4. サーバ側の「最後に選択した Group」も更新（次回ログイン時の遷移先になる）

### F12. 招待発行

1. ヘッダーから招待管理画面（`/invitations`）→ 「新規招待を発行」
2. （任意）招待先のメモ（誰宛か）を入力
3. 招待 URL（トークン付き）が生成される
4. URL をコピーしてメール / チャット等で共有相手に送る
5. 招待先がアカウント作成を完了すると、招待のステータスが「使用済み」になる
6. 未使用の招待は Owner が取消可能

招待は Owner 単位の機能のため Group コンテキストに依存しない（Group セレクタの選択状態に関わらず実行可能）。

## 公開ページの表示内容（仮）

### League 公開ページ `/l/:publicSlug`

- League 名 / 形式 / 適用 Ruleset
- 順位表（プレイヤー × 集計指標）
- Match 一覧（連番・名前・開催日・対局数）
- 対局履歴（最新順、Match 横断）

### Match 公開ページ

- Match 名 / 開催日 / メモ / 適用 Ruleset
- Match 内順位表
- 対局履歴（Match 内、最新順）
- 各 Game の素点・ポイント・順位

### 個人成績ページ（League 内） `/l/:publicSlug/players/:playerId`

- プレイヤー名
- League 内の集計指標（対局数 / 合計ポイント / 平均ポイント / トップ回数 / 平均着順 / ラス回数）
- Match 別の成績テーブル
- 対局履歴（League 内、最新順）

League の順位表からプレイヤー名をクリックして遷移する想定。

## 仮置き事項

| 論点 | 仮置きの方針 |
|---|---|
| 認証方式 | メール + パスワード、**招待制**（公開サインアップなし。OAuth は後続） |
| 招待 URL の共有手段 | 手動（コピー&ペースト）。メール自動送信は MVP 外 |
| 招待トークンの有効期限 | 仮: 7 日 |
| Game の削除方法 | 物理削除（論理削除に切り替える可能性あり） |
| `publicSlug` の文字数・命名規則 | 推測困難なランダム文字列（実装フェーズで決定） |
| 「最後に選択した Group」の保持 | サーバ側に Owner ごとに保存。未保持・無効時は最古/最新の Group か `/groups/new` にフォールバック（実装時確定） |
| Group 単位の公開ページ | MVP 対象外 |
| League 外カジュアル対局の公開 | MVP 対象外 |
| 対局結果入力時の入力補助 | 「最後の人の点数は自動計算」のような UX は実装フェーズで判断 |
