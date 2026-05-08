---
sidebar_position: 2
---

# ドメインモデル

このアプリで扱う主要エンティティと、その関係・計算ルールを定義する。実装の詳細（DB スキーマ、API 設計）には踏み込まず、要件レベルでの構造を示す。

## 全体像

```
Owner (アカウント)
  └─ Group (1..N)
       ├─ Player    (Group 配下の登録名。アカウントなし)
       ├─ Ruleset   (ウマ・飛び賞などの "テンプレート"。作成時の初期値として使う)
       ├─ League    (0..N / 任意 / ルール値を埋め込みデータとして保持)
       ├─ Match     (0..N / 任意 / League 紐付けは任意 / ルール値を埋め込みデータとして保持)
       └─ Game      (0..N / Match 紐付けも League 紐付けも任意 / ルール値を埋め込みデータとして保持)
            └─ GameResult (Game に対して 3 or 4 件)
```

主な前提:

- **Player は Group に属する**。同一人物が複数 Group に登録されている場合、別人として扱う（MVP では統合しない）。
- **League / Match / Game の紐付けはすべて任意**。Game は Group には必ず属するが、Match や League への紐付けは状況に応じて 0 〜 2 つ持つ。
- **Ruleset は単なるテンプレート**。League / Match / Game はそれぞれ自分のルール値（配給原点・原点・ウマパターン・飛び賞ポイント）を **埋め込みデータ** として保持する。Ruleset を後から編集しても、既存の League / Match / Game には影響しない。
- **計算は常に Game 自身のルール値（スナップショット）で行う**。親 Match / League のルールを変更しても過去の Game の計算結果は変わらない。

### Game の所属パターン

| `matchId` | `leagueId` | 状況 |
|---|---|---|
| null | null | Group 直下のカジュアル対局 |
| null | あり | League に直接ぶら下がる単発 Game（Match を切っていない） |
| あり | null | League に属さない Match（オフ会・合宿など）の中の Game |
| あり | あり | League 内の Match の中の Game（最も一般的） |

整合性制約: `matchId` と `leagueId` が両方ある場合、`Game.leagueId === Match.leagueId` を強制する。

## エンティティ詳細

### Owner

アプリのアカウント。書き込み権限を持つ唯一のロール。

| フィールド | 型 | 備考 |
|---|---|---|
| id | UUID | |
| email | string | 認証用 |
| createdAt | timestamp | |

### Group

プレイヤー登録の最小単位。例: 「金曜定例会」「会社の同期会」など。

| フィールド | 型 | 備考 |
|---|---|---|
| id | UUID | |
| ownerId | UUID | Owner への参照 |
| name | string | |
| defaultRulesetId | UUID? | League / 単発 Match / 単発 Game 作成時に初期値として参照する Ruleset テンプレート |
| createdAt | timestamp | |

### Player

Group 配下の登録名。アプリのアカウントを持たない。

| フィールド | 型 | 備考 |
|---|---|---|
| id | UUID | |
| groupId | UUID | |
| name | string | |
| isActive | boolean | `false` の場合、新規 Game に追加不可 |
| createdAt | timestamp | |

- 削除可否は対局履歴に依存する:
  - **過去の Game（`GameResult`）に登場していない** Player → **物理削除可能**
  - **登場している** Player → **削除不可**。引退・脱退は `isActive = false` で表現する。

### Ruleset（テンプレート）

ウマ・飛び賞などの計算設定の **テンプレート**。Group 配下に複数定義できる。League / Match / Game の作成フォームで初期値として読み込まれる。Ruleset 自身は計算には直接使われない（計算は各エンティティの埋め込みルール値で行う）。

| フィールド | 型 | 備考 |
|---|---|---|
| id | UUID | |
| groupId | UUID | Ruleset は Group 配下で管理 |
| name | string | 例: "標準（ウマ 10-30）" |
| startingScore | int | 配給原点（例: 25000） |
| returnScore | int | 原点 / オカ計算用（例: 30000） |
| umaPattern | enum | `UMA_10_30` / `UMA_10_20` / `UMA_5_10` (将来追加) |
| tobiPoint | decimal | 飛び賞ポイント。`0` なら飛び賞なし、`> 0` なら有効 |

#### ウマパターン（MVP）

| ID | 4 人麻雀 | 3 人麻雀 |
|---|---|---|
| `UMA_10_30` | +30 / +10 / −10 / −30 | 仮置き（後で確定） |
| `UMA_10_20` | +20 / +10 / −10 / −20 | 仮置き（後で確定） |
| `UMA_5_10` | +10 / +5 / −5 / −10 | 仮置き（後で確定） |

将来追加できるよう、enum ではなくデータとして保持する余地を残す（実装フェーズで判断）。

#### オカ

- **トップ総取り・固定**。Ruleset でのオプション化はしない。
- 計算: `oka = (returnScore − startingScore) × 人数 / 1000`
- 例: 25000 持ち / 30000 返し / 4 人 → `(30000 − 25000) × 4 / 1000 = +20.0` を 1 位に加算。

### League

Group 内に作る「期間付き / 形式固定の集計単位」。ルール値は埋め込みデータとして保持する。

| フィールド | 型 | 備考 |
|---|---|---|
| id | UUID | |
| groupId | UUID | |
| name | string | 例: "2026 春季リーグ" |
| format | enum | `4P_HANCHAN` / `4P_TONPU` / `3P_HANCHAN` / `3P_TONPU` |
| startingScore | int | 配給原点（埋め込み） |
| returnScore | int | 原点（埋め込み） |
| umaPattern | enum | ウマパターン（埋め込み） |
| tobiPoint | decimal | 飛び賞ポイント（埋め込み。0 なら飛び賞なし） |
| publicSlug | string | URL 共有用の識別子（推測されにくいランダム文字列） |
| createdAt | timestamp | |

- 形式は **作成時に固定**。途中で 4 人 ↔ 3 人 や 半荘 ↔ 東風 の切り替えは不可。
- ルール値は作成時に Ruleset テンプレート（または Group デフォルト）から初期化されるが、保存後は独立。テンプレートを後で編集しても League には反映されない。
- League のルール値の編集は可能（既存 Match / Game への影響は次項参照）。

### Match

複数の Game を束ねる単位。例: "第 1 戦"、"5/6 定例" など。ルール値は埋め込みデータとして保持する。

| フィールド | 型 | 備考 |
|---|---|---|
| id | UUID | |
| groupId | UUID | 必須 |
| leagueId | UUID? | 任意。指定すれば League 集計に含まれる |
| name | string | 自由入力（例: "第 1 戦"） |
| sequenceNumber | int? | 連番（League 配下なら自動採番、それ以外は任意） |
| heldAt | date? | 開催日（任意） |
| memo | string? | メモ（任意） |
| startingScore | int | 配給原点（埋め込み） |
| returnScore | int | 原点（埋め込み） |
| umaPattern | enum | ウマパターン（埋め込み） |
| tobiPoint | decimal | 飛び賞ポイント（埋め込み。0 なら飛び賞なし） |
| createdAt | timestamp | |

- Match 配下の Game の `leagueId` は、Match の `leagueId` と一致する（または両方 null）。
- ルール値は作成時に親 League（あれば）または Group デフォルト Ruleset から初期化されるが、保存後は独立。
- Match 自身も Owner による編集・削除が可能。

### Game

1 半荘 or 1 東風 の対局 1 回分。ルール値は **スナップショット** として埋め込みで保持する。

| フィールド | 型 | 備考 |
|---|---|---|
| id | UUID | |
| groupId | UUID | 必須 |
| matchId | UUID? | 任意 |
| leagueId | UUID? | 任意。Match があれば `match.leagueId` と一致 |
| format | enum | League があればそれと一致。なければ Game 自体が保持 |
| startingScore | int | 配給原点（スナップショット） |
| returnScore | int | 原点（スナップショット） |
| umaPattern | enum | ウマパターン（スナップショット） |
| tobiPoint | decimal | 飛び賞ポイント（スナップショット。0 なら飛び賞なし） |
| playedAt | timestamp | 入力時のタイムスタンプ |
| createdAt | timestamp | |

- Game は 3 or 4 件の `GameResult` を持つ（`format` の人数と一致）。
- ルール値は作成時に親 Match → 親 League → Group デフォルト Ruleset の順で初期化されるが、保存後は独立したスナップショット。親側のルールを変更しても過去 Game の計算結果は変わらない。
- Owner による編集・削除が可能（入力ミス修正のため）。編集時はスナップショットの値もフォーム上で変更可能。

### GameResult

Game に対する各 Player の結果レコード。

| フィールド | 型 | 備考 |
|---|---|---|
| gameId | UUID | |
| playerId | UUID | |
| rawScore | int | 素点（実値、例: `32000`） |
| points | decimal | ウマ・オカ・飛び賞反映後のポイント（例: `+12.0`） |
| rank | int | 1..4 （3 人麻雀は 1..3） |
| tobiRole | enum? | `INFLICTOR`（飛ばした側）/ `VICTIM`（飛んだ側）/ null |

- 入力は **素点のみ**。`points` と `rank` は **Game 埋め込みのルール値** から算出して保存する。
- 整合性検証: 同 Game 内の `rawScore` 合計 === `startingScore × 人数` でなければ保存しない。

## 作成時のルール継承

Ruleset テンプレートと埋め込みルール値の関係:

| 作成対象 | フォーム初期値の取得元 |
|---|---|
| League | Group の `defaultRulesetId` テンプレート（必要なら別テンプレートを選択） |
| Match（League 配下） | 親 League の埋め込みルール値（必要なら別テンプレートを選択） |
| Match（League 外） | Group の `defaultRulesetId` テンプレート（必要なら別テンプレートを選択） |
| Game（Match 配下） | 親 Match の埋め込みルール値 |
| Game（League 直下、Match なし） | 親 League の埋め込みルール値 |
| Game（Group 直下カジュアル） | Group の `defaultRulesetId` テンプレート |

- 初期値はあくまでフォームに流し込まれるだけで、ユーザは個別に値を編集してから保存できる。
- 保存後の各エンティティは独立。Ruleset テンプレートや親エンティティのルールを後で編集しても、既存の埋め込み値は変わらない。
- Group 作成時にデフォルト Ruleset を 1 つ自動作成し、`defaultRulesetId` に設定する運用とする（フォーム初期値の取得失敗を避けるため）。

## ポイント計算

各 Player のポイントは Game 自身の埋め込みルール値で計算する:

```
points = (rawScore − returnScore) / 1000
       + uma[rank]
       + (rank === 1 ? oka : 0)
       + tobiAdjustment
```

- `returnScore` / `uma[*]` / `oka` は **Game の埋め込みルール値** から導出する
- `oka` は前述の式（`(returnScore − startingScore) × 人数 / 1000`）
- `tobiAdjustment`:
  - `tobiPoint > 0` かつ Game に飛びがあった場合のみ加算
  - `INFLICTOR`: `+tobiPoint`
  - `VICTIM`: `−tobiPoint`
  - それ以外: `0`
  - `tobiPoint === 0` の Game では飛び賞は計算しない

## 順位ロジック

### 対局内（GameResult.rank）

- `rawScore` の降順で順位付け。
- 同点は **同順位 + 次順位スキップ**（例: 1, 2, 2, 4）。
- 同順位グループのウマは **均等割り**。

### Match 内

- Match に属する Game の `points` 合計の降順。

### League 内

- League に属する全 Game（Match 経由・直接の両方）の `points` 合計の降順。
- 同点時のタイブレーク（合計素点 → 平均着順 → トップ回数 など）は実装フェーズで決定（仮置き）。

### Group 通算

- Group 内の全 Game（League / Match 紐付けの有無を問わず）の `points` 合計。

## 集計指標（Player 単位で表示）

各スコープ（Group 通算 / League 内 / Match 内）で以下を表示:

- 対局数
- 合計ポイント
- 平均ポイント
- 合計素点
- 平均素点
- トップ回数
- 平均着順
- ラス回数（4 人麻雀のみ）

## 仮置き事項（後で確定）

| 論点 | 仮置きの方針 |
|---|---|
| 3 人麻雀のウマ値 | 上記表は後で確定 |
| 同点ウマの端数処理 | 小数点以下の保持桁数（仮: 小数第 1 位） |
| 飛び賞の複数飛び・自模飛び | 直接の `INFLICTOR`/`VICTIM` ペア以外は 0、複合ケースは別途検討 |
| 親 League / Match のルール変更時の挙動 | 既存 Match / Game は再計算しない（埋め込みルール値はスナップショットとして保持） |
| League / Match 同点時のタイブレーク | 実装フェーズで決定 |
| Match の `sequenceNumber` の扱い | League 配下では自動採番、League 外では任意入力（仮） |
| Group の共同管理（複数 Owner） | 後続フェーズ |
| Player の改名・マージ | 後続フェーズ |
