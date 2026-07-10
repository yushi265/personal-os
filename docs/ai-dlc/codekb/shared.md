# codekb: shared（横断）

> 記述は仮説・正本はコードと spec。読む側は `参照:` パスの実在を必ず確認すること（[README.md](./README.md) の鮮度規約）。

## 公開インターフェース

- エンティティ更新（フィールド単位）: `PATCH /api/entity/field` に `{ key: EntityFieldKey, value }`。webapp からは `useUpdateEntityField(entity).mutate({key, value})` 経由（直接 fetch しない）。楽観更新・ロールバック・キャッシュ 3 点パッチ（entity 単体 / entities 一覧 / 親の children）込み（参照: src/server/ApiRouter.ts / webapp/src/hooks/useEntityMutations.ts）
- `EntityFieldKey` は `title/status/priority/due/start/reviewCycle/goal/project/tags/labels/blockers`。`tags`/`labels` の validate/write は `case "tags": case "labels":` の fallthrough で共有（参照: src/services/EntityFieldService.ts）
- フィルタクエリ言語（`key:value`）: `src/domain/query.ts` の `parseQuery`/`evaluate`。`tags:`/`labels:` はカンマ区切り OR・大文字小文字区別（参照: src/domain/query.ts）
- APIクライアントのグローバルハンドラ: `setUnauthorizedHandler`（401時・トークン破棄後）/ `setServerUnreachableHandler`（fetch TypeError時・`ApiError(status=0)` を throw）。main.tsx の Root が登録し全画面切替（unreachable > unauthorized > App の優先順）（参照: webapp/src/api/client.ts / webapp/src/main.tsx）
- PWA: manifest は `manifest.json` 名（vite-plugin-pwa の `manifestFilename`）で生成 = StaticServer の既存 `.json` MIME マップで配信でき `src/server/` 無改修。SW は generateSW・autoUpdate・precache はビルド成果物のみ・`/api/` は denylist で素通し（参照: webapp/vite.config.ts）

- Todo キャンセル: `PATCH /api/todos/cancel` に `{ todo: Todo, cancelled: boolean }` → 200 `{ok:true}` / 409 `E003`。webapp は `useSetTodoCancelled` 経由（楽観更新: statusChar 書き換え）。実体は `TodoService.setCancelled`（戻り値は toggle 系と同じ `TodoWriteResult`）（参照: src/server/ApiRouter.ts / src/services/TodoService.ts / webapp/src/hooks/useTodoMutations.ts）

## 主要データ構造

- `Entity.tags: string[]` / `Entity.labels: string[]` は frontmatter 一級フィールド（`KNOWN_FRONTMATTER_KEYS` 掲載・未知キーは `extra` 退避）。単一文字列は `toStringArray()` で配列正規化（参照: src/domain/entity.ts）

- `TICKET_STATUSES` に `cancelled`（`done` と `archived` の間・POS-3）。cancelled は OPEN_STATUSES 非掲載＝終端。Kanban ticket 列は archived と cancelled を除外（参照: src/domain/entity.ts / src/ui/kanban/kanbanData.ts）
- `Todo.statusChar?: string` = checkbox 生文字の正本（`- [${statusChar}]` で verbatim 復元・`"-"` = cancelled・欠落時は done からフォールバック）。done との相互排他は DataviewAdapter.toTodo が正規化（参照: src/domain/todo.ts / src/infra/DataviewAdapter.ts）

## 再利用可能な部品

- チップ編集: `webapp/src/components/TagChipsEdit.tsx`（tags/labels 共用・`{values, onCommit}`・カンマ区切り複数追加+重複除去 = Obsidian 側 TagChips.svelte 互換）。内部実装は `ChipListEditor.tsx`（参照: webapp/src/components/TagChipsEdit.tsx）
- webapp 一覧の列ヘッダ: `SortableColumnHeader` — ソート可能列 `columns` + ソート不可の後置列 `staticColumns?: StaticColumn[]`（POS-1 で追加。参照: webapp/src/components/SortableColumnHeader.tsx）
- webapp フィルタ純関数: `webapp/src/lib/entityFilter.ts` — `matchesLabels`（OR・空選択全通し）/ `collectLabelOptions`（一意集計・昇順）/ `matchesFilter`（keyword×status×labels AND 合成）。**import 文ゼロ（構造的型付け）**（参照: webapp/src/lib/entityFilter.ts）

- `isClosedStatus(status)` = done|cancelled（一覧の既定非表示述語・webapp から `@domain` import 可）/ `isCancelledTodo(todo)`（参照: src/domain/entity.ts / src/domain/todo.ts）
- `fillKanbanColumnNames(saved, defaults)` — data.json 浅いマージで欠落した列名キーを既定値で補完（カスタム名温存・loadSettings で適用）（参照: src/settings/settings.ts / src/main.ts）

## 既知の罠

- webapp のロジックを root Vitest（`tests/**`）でテストするには **import 文ゼロの純関数**にする必要がある。root tsconfig に paths 定義がなく vitest alias も `obsidian` のみのため、`@domain` 等のエイリアス import を含む webapp ファイルをテストから相対 import すると root typecheck が壊れる（既存 `webapp/src/lib/sortEntities.ts` が @domain import のため未テストなのはこれが理由）。出典: docs/ai-dlc/retro/POS-1.md
- aidlc engine の nudge hook は「spec ディレクトリ名 = state 名」を提案するが、artifact guard は「state 名 = チケット番号のみ」（glob `<name>-*`）を期待し不一致。state は `state/<TICKET>.md`（例: POS-1.md）で作るのが正（guard 側に合致）。nudge の誤発火は無視してよい。出典: docs/ai-dlc/retro/POS-1.md
- `qlmanage -t` での SVG→PNG 変換は**透過を白背景に合成する**（角丸アイコン等の透過が必要な用途に不適）。透過が要る場合は Chrome headless（`--default-background-color=00000000`）で 512px を出し `sips` で縮小する。全面ベタ塗り（maskable）は qlmanage で可。出典: docs/ai-dlc/retro/POS-2.md
- vite-plugin-pwa は `virtual:pwa-register` を import しないと `registerSW.js` を index.html へ自動注入する（injectRegister: auto）。virtual module 方式（workbox-window の自動リロード付き）にするなら main.tsx で `registerSW()` を呼ぶ + `vite-env.d.ts` に `/// <reference types="vite-plugin-pwa/client" />`。出典: docs/ai-dlc/retro/POS-2.md
- Tier 1 トリガー領域（`src/server/**` 等）に触れる前に「触れない実装代替」を探す価値がある（例: `.webmanifest` MIME 追加 → `manifest.json` 命名で回避）。出典: docs/ai-dlc/retro/POS-2.md

- Dataview の `STask.status` は checkbox の生文字をそのまま保持する（`result.status = this.task.status`）。`completed` は `x/X` のみ true なので `[-]` は素通しすると「未完了」に潰れる — statusChar で拾うこと。出典: docs/ai-dlc/retro/POS-3.md
- 一覧の「閉じた status を隠す」判定を増減する時は 2 箇所直す: `src/domain/entity.ts` の `isClosedStatus` と `webapp/src/lib/entityFilter.ts` のインライン複製（import 文ゼロ制約のため複製が正）。出典: docs/ai-dlc/retro/POS-3.md

## 最終更新

- POS-3 / 2026-07-10（本ボルトの実装コミットに同梱）
