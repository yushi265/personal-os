# POS-3: webapp（ブラウザ React）詳細設計

> レイヤー規約: `src/server/` の HTTP API 経由でのみプラグイン状態に触れる（[architecture.md](../../architecture.md)）。
> webapp はテストランナーを持たない（既存規約）: 担保は共有ロジックの domain 単体テスト + `tsc --noEmit` + build + 実機確認。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-2**: webapp のプロジェクト一覧・チケット一覧・プロジェクト詳細のチケット表で、`status: cancelled` の行が done と同様デフォルト非表示になり、「完了・キャンセルを表示」チェックONで表示される（チェックボックスは1つに統合）
- **AC-5**: Todo をキャンセル/解除できる: `PATCH /api/todos/cancel` が対象行を `- [-]` / `- [ ]` に書き換え、webapp（TodoListPanel）とプラグイン（TodoList）のUIから操作できる
- **AC-8**: Todo 一覧（webapp: TodoListPanel / Todos / Inbox、プラグイン: TodoList）で cancelled Todo がデフォルト非表示になり、表示チェックONで取り消し線+グレーで表示される

## このレイヤーが公開する契約（外部インターフェース）

| 操作 | 名前 | 契約 | 用途 |
|------|------|------|------|
| 変更 | `entityFilter.matchesFilter` | 第5引数を `hideClosed` に改名し、判定を `hideClosed && (status === "done" \|\| status === "cancelled")` へ。※このファイルは「import 文ゼロ」の既存設計制約（root Vitest の `tests/webapp/entityFilter.test.ts` が alias 無しで直接 import する）があるため、`@domain` の `isClosedStatus` は import せず同一判定をインライン複製する（labels 判定の複製前例に倣う）。判定を変える時は domain 側と両方直すこと | AC-2（done+cancelled を1条件で非表示） |
| 変更 | `ProjectDetail.tsx` のチケット絞り込み | インライン判定 `c.status !== "done"` を `!isClosedStatus(c.status)` へ（matchesFilter 非経由の唯一の箇所・足し忘れ事故ポイント） | AC-2 |
| 変更 | `StatusBadge.STATUS_DOT` | `cancelled: "bg-zinc-300 dark:bg-zinc-600"`（archived と同値） | ドット色 |
| 変更 | `TodoListPanel.tsx` | 非表示: `showDone \|\| (!todo.done && !isCancelledTodo(todo))`。cancelled 行: 取り消し線+`text-muted-foreground`（done と同じ見た目）・checkbox disabled。行ボタン列に「キャンセル」/「キャンセル解除」を追加。allDone お祝い演出は cancelled を母数から除外（非 cancelled が1件以上かつ全 done） | AC-5・AC-8 |
| 変更 | `Todos.tsx` / `Inbox.tsx` | 非表示条件とスタイルを TodoListPanel と同条件に（操作ボタンの追加はスコープ外・表示のみ）。※Inbox は従来 showDone トグル自体が無く done も常時表示だったため、本変更で **Inbox に showDone トグルが新設され done Todo も既定非表示になる**（挙動変化・Gate 3 で明示確認） | AC-8 |
| 追加 | `api/endpoints.ts` `setTodoCancelled(todo, cancelled)` | `PATCH /api/todos/cancel` body `{todo, cancelled}`（[services.md](./services.md) の HTTP 契約） | AC-5 |
| 追加 | `hooks/useTodoMutations.ts` `useSetTodoCancelled` | 楽観更新: `{...todo, statusChar: cancelled ? "-" : " ", done: false}` でキャッシュパッチ・失敗時ロールバック（既存 useToggleTodo と同パターン） | AC-5 |

- 「完了・キャンセルを表示」の文言は共有キー `manage.filter.showDone` の変更（[ui.md](./ui.md) 側）に自動追随（webapp は `@i18n/ja` を import）。
- ステータス選択・フィルタチップへの cancelled 追加は `TICKET_STATUSES` 共有により**自動**（確認のみ）。

## このレイヤーが依存する下位の契約（呼び出す相手）

- HTTP API: `PATCH /api/todos/cancel`・`POST /api/entity/status`（[services.md](./services.md) が正本）。Bearer トークンは既存 apiClient が一元付与。
- domain 共有型: `Todo.statusChar` / `isCancelledTodo` / `isClosedStatus`（[domain.md](./domain.md)）。

## 実装配置

- `webapp/src/lib/entityFilter.ts` / `webapp/src/routes/ProjectDetail.tsx`・`Todos.tsx`・`Inbox.tsx` / `webapp/src/components/TodoListPanel.tsx`・`StatusBadge.tsx` / `webapp/src/api/endpoints.ts` / `webapp/src/hooks/useTodoMutations.ts`

## UI/UX 方針

- **画面フロー / 導線**: Todo のキャンセルはプロジェクト/チケット詳細の TodoListPanel 行ボタン（昇格・削除の並びに Ban アイコン）。チケットのキャンセルは既存 StatusSelect から。
- **主要操作とフィードバック**: 楽観更新で即時に行が消える（showDone OFF）/ 取り消し線化（ON）。失敗時は toast + ロールバック（既存パターン）。
- **状態設計**: cancelled 表示は done 表示と同じ（取り消し線+muted）。checkbox は disabled（解除は専用ボタン）。空/ローディング/エラーは既存表示を変更しない。
- **既存デザインシステムとの整合**: 新規コンポーネントなし。lucide の `Ban` / `Undo2` アイコンを既存ボタンスタイルで使用。

### レスポンシブ / アクセシビリティ

- 主対象は既存 webapp と同じ（デスクトップ + モバイル PWA）。行ボタンは既存の TodoListPanel ボタン列に追加するだけでレイアウト変更なし（狭幅でも折り返しは既存挙動）。
- a11y: キャンセルボタンに `aria-label`（「キャンセル」/「キャンセル解除」）。cancelled 行の checkbox は `disabled` + 状態がテキスト装飾（line-through）でも判別可能。

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| `PATCH /api/todos/cancel` が 409 E003 | toast 表示 + 楽観更新ロールバック（useToggleTodo と同じ） |
| 401 / サーバー未達 | 既存グローバルハンドラ（UnauthorizedScreen / ServerUnreachableScreen）に委譲・本変更で追加なし |

## テストケース（技法注記付き）

- `entityFilter.ts` は root Vitest（`tests/webapp/entityFilter.test.ts`）でテスト可能（例外・import 文ゼロ制約の理由）。その他のロジックの担保は domain 側テスト（`isClosedStatus`・`isCancelledTodo`・[domain.md](./domain.md)）に置く。
- [デシジョンテーブル] matchesFilter: hideClosed=true × status"cancelled" → false / hideClosed=false(既定) × "cancelled" → true / hideClosed=true × 他条件全一致 × "cancelled" → false（既存の done 系ケースと対）
- [手動確認] プロジェクト一覧/チケット一覧/プロジェクト詳細: cancelled 行が既定非表示 → 「完了・キャンセルを表示」ON で表示
- [手動確認] TodoListPanel: キャンセル → 行が消える（OFF時）/ 取り消し線表示（ON時）→ 解除で復帰
- [検証コマンド] `npm run typecheck` / `npm run build`（webapp）
