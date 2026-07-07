# POS-1: webapp ラベル（labels）機能の接続

> 薄い実装 spec の入口。読み手は人間（Gate 1/2/3 承認者）。AI 実装エージェントは [webapp.md](./webapp.md) を読む。

## 概要

Obsidian プラグイン側で実装済みの `labels`（frontmatter 配列・編集 API・フィルタ言語）を webapp（ブラウザ React UI）に接続する。
詳細画面での表示・編集、プロジェクト一覧でのチップ表示とラベル絞り込みを追加する。
design-browser-ui.md §9 P4（詳細画面+全操作）で計画されながら未配線だった `TagChipsEdit` の配線を完遂するボルト。

## 対象範囲

- 対象レイヤー: **webapp のみ**（詳細は [webapp.md](./webapp.md)。UI/UX 方針も同ファイルが正本）
  - 付随して `src/i18n/ja.ts` への文言キー **追加のみ**（既存キーの変更なし・プラグイン挙動に影響なし）を含む
- 対象ドメイン: エンティティ（project / ticket）の `labels` フィールド
- 対象外（やらないこと）:
  - `tags` の webapp 接続（次ボルト候補）
  - プロジェクト詳細内チケット表（TicketRow）への labels 列追加
  - Home 画面への labels 表示
  - ラベル候補サジェスト用サーバー API 新設（候補はクライアント側集計。Tier 2 維持のため）
  - IndexStore へのラベル逆引きインデックス
  - SavedView / 検索クエリ言語との webapp 連携
  - 一覧チップの「+n」溢れ表示（クリップで代替・実需が出たら別ボルト）
  - Obsidian プラグイン側（src/ui/ ほか）・サーバー（src/server/）・スキーマ（src/domain/entity.ts）の変更

## ユニット計画

単一ユニット。

## 受け入れ基準（AC）

- [ ] **AC-1**: プロジェクト詳細画面のメタデータ行に Labels プロパティが表示され、チップの追加・削除で当該エンティティの `labels` が既存 API（`PATCH /api/entity/field`, `key=labels`）経由で更新される（楽観更新・成功トーストなし）
- [ ] **AC-2**: チケット詳細画面でも AC-1 と同一の Labels 表示・編集ができる
- [ ] **AC-3**: labels 未設定のエンティティでは、詳細画面の Labels は入力欄（プレースホルダー）のみを表示する
- [ ] **AC-4**: プロジェクト一覧の各行に labels がチップ表示され、列ヘッダに Labels 列名（ソート不可）が表示される。labels 未設定の行は空欄
- [ ] **AC-5**: プロジェクト一覧の Labels フィルタで選択したラベルのいずれかを持つプロジェクトのみが表示される（OR・大文字小文字区別）。選択 0 件では labels で絞り込まない
- [ ] **AC-6**: Labels フィルタの候補は取得済みプロジェクトの labels を一意集計し昇順で表示する。候補 0 件時は空状態文言を表示する
- [ ] **AC-7**: keyword・status・labels の各フィルタ条件は AND で組み合わされる

## アーキテクチャ / レイヤー間フロー

```
webapp（変更あり）
  ├─ 表示/編集: entity.labels → TagChipsEdit（既製・未使用部品を接続）
  │     onCommit → useUpdateEntityField({key:"labels", value:string[]})
  │     → PATCH /api/entity/field（既存・変更なし）
  │     → EntityFieldService → processFrontMatter（既存・変更なし）
  └─ フィルタ: useEntities("project") の取得済みデータ
        → collectLabelOptions()（クライアント集計・新規純関数）
        → matchesFilter()（keyword/status/labels AND 合成・新規純関数）
```

サーバー・domain・Obsidian UI は一切変更しない。レイヤー間 IF（API 契約）は既存のまま。

## エラー・ログ方針（横断サマリ）

| シナリオ | server | webapp の挙動 |
|---|---|---|
| labels 更新 API 失敗（400/401/404/5xx/断） | 既存エラー応答（変更なし） | 楽観更新ロールバック + エラートースト（既存 `useOptimisticMutation` 共通処理・新規コードなし） |
| フィルタ候補 0 件 | — | Popover 内に空状態文言を表示 |
| 不正な labels 値（非配列） | 既存 `EntityFieldService.validate` が 400（変更なし） | UI からは配列のみ送出（`TagChipsEdit` 経由） |

## テスト戦略

> ケース詳細は [webapp.md](./webapp.md) の「テストケース」節を参照。
> **webapp にはコンポーネントテスト基盤が無い**（既存流儀: design-browser-ui.md §9 の検証方法欄はいずれも「手動 + tsc/build」。
> 既存の webapp/src/lib/sortEntities.ts も同様に自動テストなし）。本ボルトでは新規ロジックを**依存ゼロの純関数**
> （`webapp/src/lib/entityFilter.ts`）に寄せ、root Vitest（`tests/webapp/`）で単体担保する。
> UI 配線（AC-1〜4 の表示部分）は `npm run webapp:build`（referee-check の webapp レイヤー）+ ブラウザ手動確認で担保する
> — テスト削減ではなく基盤不在による代替であり、その根拠はこの節を正本とする。

| AC | 単体 | レイヤー内結合 | 補足 |
|----|------|--------------|------|
| AC-1 | — | 既存 `tests/server/ApiRouter.test.ts`（field 更新ディスパッチ）/ `tests/services/EntityFieldService.test.ts`（`tags` キーのテストが `case "tags": case "labels":` の共有コードパスを実行・変更なし・再利用） | UI 配線は webapp:build + 手動確認 |
| AC-2 | — | 同上 | 同上 |
| AC-3 | — | — | 既存 TagChipsEdit の挙動。webapp:build + 手動確認 |
| AC-4 | — | — | webapp:build + 手動確認 |
| AC-5 | `tests/webapp/entityFilter.test.ts`（matchesLabels / matchesFilter） | — | UI 配線は手動確認 |
| AC-6 | `tests/webapp/entityFilter.test.ts`（collectLabelOptions） | — | 空状態表示は手動確認 |
| AC-7 | `tests/webapp/entityFilter.test.ts`（matchesFilter デシジョンテーブル） | — | — |

## 既存実装との関係（再利用 / 差分 / 衝突）

- **再利用**（新規実装しないもの）:
  - `webapp/src/components/TagChipsEdit.tsx` / `ChipListEditor.tsx` — 実装済み・未使用の編集部品をそのまま接続
  - `useUpdateEntityField`（webapp/src/hooks/useEntityMutations.ts）— labels 更新・楽観更新・ロールバック・キャッシュ 3 点パッチ対応済み
  - `PATCH /api/entity/field`（src/server/ApiRouter.ts）+ `EntityFieldService`（labels の配列 validate 済み）— 変更なし
  - UI 部品: `Badge` / `Popover` / `Checkbox` / `PropertyLabel`（既存）
  - i18n 既存キー: `preview.section.labels`（"Labels"）/ `manage.column.labels`（"Labels"）/ `preview.tagChips.placeholder` / `preview.tagChips.remove`
- **差分**: `Projects.tsx` ローカルの `matchesFilter` を `webapp/src/lib/entityFilter.ts` へ移設し labels 条件を追加（既存の keyword/status 意味論は不変。移設で既存ロジックにも単体テストが付く）
- **依存**: フィルタの OR 意味論は `src/domain/query.ts` の `labels:` 評価（`splitOr().some()`・大文字小文字区別）に合わせる（Obsidian 側・将来の SavedView 連携と意味論を揃えるため）
- **衝突**: なし（新規フィールド・新規 API・スキーマ変更を伴わない）

## 実装に効く制約

- レイヤー間 IF（API 契約・スキーマ・ルーティング）を変更しない（Tier 2 の前提。触れる必要が出たら即停止して再宣言）
- `webapp/src/lib/entityFilter.ts` は **import 文ゼロ（構造的型付け）** とする — root tsconfig（paths 定義なし）・root Vitest（alias は obsidian のみ）・webapp tsconfig の 3 環境すべてで解決可能にするため。`@domain` 等のエイリアス import を書くと root typecheck が壊れる
- `src/i18n/ja.ts` へはキー追加のみ（既存キーの変更・削除禁止）
- 一覧の labels 列はレイアウト上クリップ許容（横スクロールを発生させない）

## 判断根拠 / 未決事項

- **labels のみ接続し tags を見送る**: Gate 1 で確定したスコープ（ユーザー要望は「一覧に表示はあるが設定できない」の解消）。tags は同型の後続ボルトで安価に追加できる
- **フィルタ OR 意味論**: `domain/query.ts` の `labels:a,b` 評価（OR）・Projects の status フィルタ（OR）と一致させる。AND 絞り込みは実需が出たら検討（YAGNI）
- **候補集計をクライアント側にする**: 一覧画面は既に全 project を取得済みで、その labels を集計すれば十分。サーバー API 新設はレイヤー間 IF 変更（Tier 1 昇格）になるため却下
- **entityFilter.ts を依存ゼロにする**: vitest.config.ts / tsconfig.json（root）に手を入れず webapp ロジックを単体テスト可能にする最小手段。エイリアス追加案は root 設定の変更が波及するため却下
- **SortableColumnHeader に `staticColumns`（ソート不可の後置列）を追加する**: labels は配列でソート意味論が自明でないため SortKey には足さない（YAGNI）。ヘッダなしで列だけ足す案は列位置の整合（既存コメントの規約）を壊すため却下。後方互換のオプション prop に留める
- **詳細画面の Labels 配置**: メタデータ行（`flex flex-wrap`）の既存プロパティ群の末尾（アクションボタン群の前）。チップは可変幅のため固定幅プロパティの後ろに置き折返しに任せる
- 未決事項: なし（Gate 1 で全て確定済み）
