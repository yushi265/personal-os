# codekb: shared（横断）

> 記述は仮説・正本はコードと spec。読む側は `参照:` パスの実在を必ず確認すること（[README.md](./README.md) の鮮度規約）。

## 公開インターフェース

- エンティティ更新（フィールド単位）: `PATCH /api/entity/field` に `{ key: EntityFieldKey, value }`。webapp からは `useUpdateEntityField(entity).mutate({key, value})` 経由（直接 fetch しない）。楽観更新・ロールバック・キャッシュ 3 点パッチ（entity 単体 / entities 一覧 / 親の children）込み（参照: src/server/ApiRouter.ts / webapp/src/hooks/useEntityMutations.ts）
- `EntityFieldKey` は `title/status/priority/due/start/reviewCycle/goal/project/tags/labels/blockers`。`tags`/`labels` の validate/write は `case "tags": case "labels":` の fallthrough で共有（参照: src/services/EntityFieldService.ts）
- フィルタクエリ言語（`key:value`）: `src/domain/query.ts` の `parseQuery`/`evaluate`。`tags:`/`labels:` はカンマ区切り OR・大文字小文字区別（参照: src/domain/query.ts）

## 主要データ構造

- `Entity.tags: string[]` / `Entity.labels: string[]` は frontmatter 一級フィールド（`KNOWN_FRONTMATTER_KEYS` 掲載・未知キーは `extra` 退避）。単一文字列は `toStringArray()` で配列正規化（参照: src/domain/entity.ts）

## 再利用可能な部品

- チップ編集: `webapp/src/components/TagChipsEdit.tsx`（tags/labels 共用・`{values, onCommit}`・カンマ区切り複数追加+重複除去 = Obsidian 側 TagChips.svelte 互換）。内部実装は `ChipListEditor.tsx`（参照: webapp/src/components/TagChipsEdit.tsx）
- webapp 一覧の列ヘッダ: `SortableColumnHeader` — ソート可能列 `columns` + ソート不可の後置列 `staticColumns?: StaticColumn[]`（POS-1 で追加。参照: webapp/src/components/SortableColumnHeader.tsx）
- webapp フィルタ純関数: `webapp/src/lib/entityFilter.ts` — `matchesLabels`（OR・空選択全通し）/ `collectLabelOptions`（一意集計・昇順）/ `matchesFilter`（keyword×status×labels AND 合成）。**import 文ゼロ（構造的型付け）**（参照: webapp/src/lib/entityFilter.ts）

## 既知の罠

- webapp のロジックを root Vitest（`tests/**`）でテストするには **import 文ゼロの純関数**にする必要がある。root tsconfig に paths 定義がなく vitest alias も `obsidian` のみのため、`@domain` 等のエイリアス import を含む webapp ファイルをテストから相対 import すると root typecheck が壊れる（既存 `webapp/src/lib/sortEntities.ts` が @domain import のため未テストなのはこれが理由）。出典: docs/ai-dlc/retro/POS-1.md
- aidlc engine の nudge hook は「spec ディレクトリ名 = state 名」を提案するが、artifact guard は「state 名 = チケット番号のみ」（glob `<name>-*`）を期待し不一致。state は `state/<TICKET>.md`（例: POS-1.md）で作るのが正（guard 側に合致）。nudge の誤発火は無視してよい。出典: docs/ai-dlc/retro/POS-1.md

## 最終更新

- POS-1 / 2026-07-07（本ボルトの実装コミットに同梱）
