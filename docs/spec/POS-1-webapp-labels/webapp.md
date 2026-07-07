# POS-1: webapp 詳細設計

> レイヤー別 spec。規約: [docs/architecture.md](../../architecture.md)（webapp = ブラウザ表示層・React SPA・`src/server/` の HTTP API 経由でのみプラグイン状態に触れる）。
> AC の正本は [index.md](./index.md)。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-1**: プロジェクト詳細画面のメタデータ行に Labels プロパティが表示され、チップの追加・削除で当該エンティティの `labels` が既存 API（`PATCH /api/entity/field`, `key=labels`）経由で更新される（楽観更新・成功トーストなし）
- **AC-2**: チケット詳細画面でも AC-1 と同一の Labels 表示・編集ができる
- **AC-3**: labels 未設定のエンティティでは、詳細画面の Labels は入力欄（プレースホルダー）のみを表示する
- **AC-4**: プロジェクト一覧の各行に labels がチップ表示され、列ヘッダに Labels 列名（ソート不可）が表示される。labels 未設定の行は空欄
- **AC-5**: プロジェクト一覧の Labels フィルタで選択したラベルのいずれかを持つプロジェクトのみが表示される（OR・大文字小文字区別）。選択 0 件では labels で絞り込まない
- **AC-6**: Labels フィルタの候補は取得済みプロジェクトの labels を一意集計し昇順で表示する。候補 0 件時は空状態文言を表示する
- **AC-7**: keyword・status・labels の各フィルタ条件は AND で組み合わされる

## このレイヤーが公開する契約（外部インターフェース）

画面パスの増減なし。既存 3 画面の表示内容を拡張する。

| 操作 | 名前 / パス | 変更内容 | 用途 |
|------|------------|---------|------|
| 変更 | `/projects` | Labels 列（表示専用チップ）+ Labels フィルタ（Popover）追加 | AC-4,5,6,7 |
| 変更 | `/projects/:path` | メタデータ行に Labels プロパティ（表示+編集）追加 | AC-1,3 |
| 変更 | `/tickets/:path` | メタデータ行に Labels プロパティ（表示+編集）追加 | AC-2,3 |

### 新規モジュール契約: `webapp/src/lib/entityFilter.ts`

**import 文ゼロ（構造的型付け）**。root tsconfig（paths なし）・root Vitest（alias は obsidian のみ）・webapp tsconfig の 3 環境すべてで解決させるための制約（[index.md](./index.md) 実装に効く制約）。

```ts
export interface FilterableEntity {
  title: string;
  status: string;
  labels: string[];
}

/** selected が空なら常に true。それ以外は labels ∩ selected ≠ ∅ で true（OR・大文字小文字区別）。
 *  意味論は src/domain/query.ts の labels: 評価（splitOr().some()）と一致させる */
export function matchesLabels(labels: string[], selected: ReadonlySet<string>): boolean;

/** 全エンティティの labels を一意集計し localeCompare 昇順で返す。空入力は [] */
export function collectLabelOptions(entities: ReadonlyArray<{ labels: string[] }>): string[];

/** Projects.tsx の既存ローカル関数 matchesFilter を移設し labels 条件を AND 追加。
 *  既存意味論を変更しない: keyword = title 部分一致・大文字小文字無視・trim（空白のみは全通し）/
 *  statuses = OR（空 Set は全通し）。labels は matchesLabels に委譲 */
export function matchesFilter(
  entity: FilterableEntity,
  keyword: string,
  statuses: ReadonlySet<string>,
  labels: ReadonlySet<string>
): boolean;
```

### 既存コンポーネント拡張: `SortableColumnHeader`

後方互換のオプション prop を 1 つ追加（既存呼び出し元は無変更で動く）。

```ts
export interface StaticColumn {
  label: string;
  className: string; // 行側セルと同じ幅・shrink 指定（列位置合わせの既存規約に従う）
}
// 追加 prop: staticColumns?: StaticColumn[]
// ソート可能列の後ろに <span> で描画（button にしない）。同じタイポグラフィ・クリック不可・ソート標識なし
```

### i18n 追加キー（`src/i18n/ja.ts`・追加のみ）

| キー | 値 | 用途 |
|---|---|---|
| `webapp.projects.filterLabels` | `"Labels"` | 一覧フィルタボタン文言（`webapp.projects.filterStatus` と同型） |
| `webapp.projects.filterLabelsEmpty` | `"ラベルはまだありません"` | フィルタ候補 0 件時の空状態文言（AC-6） |

再利用する既存キー: `preview.section.labels`（詳細画面の PropertyLabel）/ `manage.column.labels`（一覧の列ヘッダ）/ `preview.tagChips.placeholder`・`preview.tagChips.remove`（TagChipsEdit 内部で使用済み）。

## このレイヤーが依存する下位の契約（呼び出す相手）

- `PATCH /api/entity/field`（src/server/ApiRouter.ts・**変更なし**）: `{ key: "labels", value: string[] }`。呼び出しは既存 `useUpdateEntityField(entity).mutate({ key: "labels", value })` に委譲（直接 fetch しない）
- `useEntities("project")`（既存）: フィルタ候補集計の入力。追加取得なし

## 実装配置

| ファイル | 変更 |
|---|---|
| `webapp/src/lib/entityFilter.ts` | **新規**。上記契約の純関数 3 つ |
| `tests/webapp/entityFilter.test.ts` | **新規**。相対 import（`../../webapp/src/lib/entityFilter`）で root Vitest から実行 |
| `webapp/src/components/SortableColumnHeader.tsx` | `staticColumns` prop 追加 |
| `webapp/src/routes/Projects.tsx` | ローカル `matchesFilter` 削除（lib へ移設）/ `labels` state（`Set<string>`）追加 / Labels Popover 追加 / ProjectRow に labels チップ列追加 / ヘッダに staticColumns 指定 |
| `webapp/src/routes/ProjectDetail.tsx` | メタデータ行に Labels プロパティ（`TagChipsEdit` 接続） |
| `webapp/src/routes/TicketDetail.tsx` | 同上 |
| `src/i18n/ja.ts` | キー 2 つ追加（上表） |

**変更禁止**: `src/domain/` / `src/server/` / `src/services/` / `src/infra/` / `src/ui/` / `webapp/src/components/TagChipsEdit.tsx` / `ChipListEditor.tsx` / `useEntityMutations.ts` / vitest.config.ts / tsconfig.json（root・webapp とも）。

### 実装の具体形（配線イメージ）

詳細画面（ProjectDetail はプロパティ群の末尾＝アクションボタン群の前、TicketDetail は Project プロパティの後）:

```tsx
<div className="flex flex-col gap-1.5">
  <PropertyLabel>{t("preview.section.labels")}</PropertyLabel>
  <TagChipsEdit
    values={entity.labels}
    onCommit={(next) => updateField.mutate({ key: "labels", value: next })}
  />
</div>
```

一覧（Projects.tsx）:

- フィルタ: status Popover の直後に同型の Popover。ボタン文言 `t("webapp.projects.filterLabels")` + 選択数 `(n)` サフィックス（status と同型）。中身は `collectLabelOptions(projects ?? [])` を Checkbox でトグル。候補 0 件時は `<p>` で `t("webapp.projects.filterLabelsEmpty")`
- 行: due セルの後に `<span className="flex w-40 shrink-0 gap-1 overflow-hidden">` — `labels.map` で `Badge variant="secondary"`（`whitespace-nowrap`）。溢れはクリップ（横スクロール禁止）
- ヘッダ: `staticColumns={[{ label: t("manage.column.labels"), className: "w-40 shrink-0 text-left" }]}`
- 絞り込み: `matchesFilter(p, keyword, statuses, labels)`（lib 版に差し替え）

## UI/UX 方針

- **画面フロー / 導線**: 新規画面なし。既存 3 画面内の拡張。一覧でラベルを見る → フィルタで絞る → 詳細で編集する、が一巡の導線
- **主要操作とフィードバック**:
  - チップ追加: 入力して Enter またはカンマ区切り（`TagChipsEdit` 既存挙動 = Obsidian 側 TagChips.svelte 互換）。blur でも確定
  - チップ削除: チップ内 × ボタン
  - 成功: 楽観更新で即時反映（成功トーストなし。priority のみトースト対象という既存方針に従う）
  - 失敗: ロールバック + エラートースト（既存 `useOptimisticMutation` 共通処理）
- **状態設計（出し分け）**:
  - 初期/ローディング/エラー: 既存画面の Skeleton / loadError 表示を踏襲（本ボルトで変更なし）
  - 空（labels なし）: 詳細画面 = 入力欄のみ（プレースホルダー `preview.tagChips.placeholder`）。一覧行 = 空欄。フィルタ候補 0 件 = `webapp.projects.filterLabelsEmpty`
  - 成功: チップ表示
- **既存デザインシステムとの整合**: `Badge`（secondary）・`Popover`＋`Checkbox`（status フィルタと同型）・`PropertyLabel`・`TagChipsEdit` を再利用。新規ビジュアル要素なし。`staticColumns` は既存ヘッダのタイポグラフィ（font-mono text-[11px] uppercase）を踏襲

### レスポンシブ / アクセシビリティ

- 対象端末: デスクトップ主対象（lg）・モバイルは既存レイアウトの折返し挙動を維持（webapp 既存方針）
- 詳細画面: メタデータ行は既存 `flex flex-wrap items-end gap-12` の折返しに任せる。Labels ブロックは「PropertyLabel + 値」の縦積み構造を他プロパティ（Status/Priority/Due）と同一にし、モバイルでの折返し挙動を既存プロパティと揃える
- 一覧: labels 列は `overflow-hidden` でクリップし、**ページ横スクロールを発生させない**。ラベル全量の確認・編集は詳細画面が担う
- a11y 最低限: チップ削除ボタンは `aria-label`（`preview.tagChips.remove`・ChipListEditor 実装済み）。フィルタは Radix `Popover`/`Checkbox` の標準キーボード操作・フォーカス管理に乗る。staticColumns は非インタラクティブ要素（span）とし、ボタンと誤認させない

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| labels 更新 API 失敗（400/401/404/5xx/ネットワーク断） | `useOptimisticMutation` 共通処理: キャッシュを更新前スナップショットへロールバックし `toast.error`（ApiError.message または E999）。**新規実装なし**（既存フックに委譲） |
| フィルタ候補 0 件 | Popover は開ける。中身に `webapp.projects.filterLabelsEmpty` を表示（Checkbox なし） |
| 選択中ラベルが更新で消滅（全 project から外れた） | 候補から消えるが選択 Set には残り、該当 0 件表示になる（既存 status フィルタと同じ割り切り。フィルタ解除は再クリックかリロード） |
| 不正な labels 値 | UI からは `string[]` しか送出できない（TagChipsEdit の onCommit 契約）。サーバー側 validate は既存のまま |

## テストケース（技法注記付き）

配置: `tests/webapp/entityFilter.test.ts`（root Vitest・相対 import・モック不要）。

`matchesLabels`:

- [同値分割] selected 空 + labels 空 → true（フィルタ未指定は全通し）
- [同値分割] selected 空 + labels `["a"]` → true
- [同値分割] selected `{a}` + labels `["a","b"]` → true
- [同値分割] selected `{a}` + labels `["b"]` → false
- [境界値] selected `{a}` + labels `[]` → false
- [同値分割] selected `{a,c}` + labels `["c"]` → true（OR: いずれか一致で可）
- [代表値] selected `{A}` + labels `["a"]` → false（大文字小文字区別 = domain/query.ts と同一意味論）

`collectLabelOptions`:

- [代表値] `[{labels:["b","a"]},{labels:["a","c"]}]` → `["a","b","c"]`（一意化 + localeCompare 昇順）
- [境界値] `[]` → `[]`
- [境界値] 全要素 `labels: []` → `[]`

`matchesFilter`（keyword × status × labels の AND 合成）:

- [デシジョンテーブル] 全条件未指定（keyword=""・statuses=∅・labels=∅）→ true
- [デシジョンテーブル] keyword のみ指定・一致 → true / 不一致 → false
- [デシジョンテーブル] statuses のみ指定・一致 → true / 不一致 → false
- [デシジョンテーブル] labels のみ指定・一致 → true / 不一致 → false
- [デシジョンテーブル] 3 条件指定・全一致 → true
- [デシジョンテーブル] 3 条件指定・keyword のみ不一致 → false
- [デシジョンテーブル] 3 条件指定・statuses のみ不一致 → false
- [デシジョンテーブル] 3 条件指定・labels のみ不一致 → false
- [同値分割] keyword は大文字小文字無視で title 部分一致（既存挙動のリグレッション）
- [境界値] keyword が空白のみ（trim すると空になる文字列）→ keyword では絞り込まない（既存 trim 挙動のリグレッション）

UI 配線（AC-1〜4 の表示・編集）は自動テスト対象外（根拠は [index.md](./index.md) テスト戦略節）。`npm run webapp:build` + ブラウザ手動確認で担保する。
