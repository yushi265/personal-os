# POS-3: ui（Obsidian プラグイン Svelte）詳細設計

> レイヤー規約: Svelte コンポーネントは services 経由で操作・Obsidian API 直接参照は View/main に限定（[architecture.md](../../architecture.md)）。
> i18n（`src/i18n/ja.ts`）は webapp からも import されるため、文言変更はここで一元管理する。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-3**: Kanban（ticketモード）の列に cancelled が生成されない（archived と同様）。詳細画面・行メニューのステータス候補には cancelled が出る
- **AC-5**: Todo をキャンセル/解除できる: `PATCH /api/todos/cancel` が対象行を `- [-]` / `- [ ]` に書き換え、webapp（TodoListPanel）とプラグイン（TodoList）のUIから操作できる
- **AC-7**: cancelled が「残作業」に数えられない: 今日のTODO・Overdue・未完了数（ダッシュボード/summary API）から cancelled Todo が除外され、cancelled チケットは Overdue 判定されない
- **AC-8**: Todo 一覧（webapp: TodoListPanel / Todos / Inbox、プラグイン: TodoList）で cancelled Todo がデフォルト非表示になり、表示チェックONで取り消し線+グレーで表示される

## このレイヤーが公開する契約（外部インターフェース）

| 操作 | 名前 | 契約 | 用途 |
|------|------|------|------|
| 変更 | `kanbanData.buildKanbanData` | ticket モードの列を `TICKET_STATUSES.filter(s => s !== "archived" && s !== "cancelled")` で生成 | AC-3（cancelled 列を出さない） |
| 変更 | `badgeStyles.STATUS_COLOR_CLASS` | `cancelled: "pos-status-done"`（done/archived と同じグレー系を再利用・新規 CSS クラスなし） | バッジ色 |
| 変更 | `TodoList.svelte` | 非表示: `showDone ? todos : todos.filter(t => !t.done && !isCancelledTodo(t))`。cancelled 行: checkbox `disabled` + `pos-todo-cancelled` クラス。アクションに「キャンセル」（open/done 時）/「キャンセル解除」（cancelled 時）を追加し `onCancel(todo, cancelled)` コールバックを親へ | AC-5・AC-8 |
| 変更 | `todoMenuBuilder.buildTodoMenu` | 同上のキャンセル/解除項目をモバイル長押しメニューに追加 | AC-5（モバイル導線） |
| 変更 | `dashboardData` | todayTodos / overdueTodos / openTodosCount の抽出から cancelled 除外（domain 述語変更に追随・`!done` 直書き箇所は明示条件追加） | AC-7 |
| 追加 | `styles.css` `.pos-todo-cancelled` | `text-decoration: line-through; color: var(--text-muted);` | AC-8 の視覚表現 |
| 変更 | i18n `ja.ts` | `"manage.filter.showDone": "完了・キャンセルを表示"`（キー名は変えない・文言のみ）。新キー `"preview.todo.cancel": "キャンセル"` / `"preview.todo.uncancel": "キャンセル解除"` | トグル文言の統合（Gate 1 決定）+ 導線ラベル |

- キャンセル操作の親配線: `ProjectDetailScreen` / `TicketDetailScreen` / `Preview` の TodoList 呼び出しに `onCancel` を追加し、`plugin.todoService.setCancelled` を呼ぶ（既存 onToggle と同じ経路・失敗時は既存の Notice パターン）。
- ステータス候補への cancelled 追加は `validStatusesOf` 由来で**自動**（コード変更なし・確認のみ）。

## このレイヤーが依存する下位の契約（呼び出す相手）

- services: `TodoService.setCancelled`（[services.md](./services.md)）
- domain: `isCancelledTodo` / `TICKET_STATUSES`（[domain.md](./domain.md)）

## 実装配置

- `src/ui/kanban/kanbanData.ts` / `src/ui/components/badgeStyles.ts` / `src/ui/components/TodoList.svelte` / `src/ui/components/todoMenuBuilder.ts` / `src/ui/dashboard/dashboardData.ts` / `src/ui/manage/ProjectDetailScreen.svelte`・`TicketDetailScreen.svelte`・`src/ui/preview/Preview.svelte`（onCancel 配線） / `src/i18n/ja.ts` / `styles.css`

## UI/UX 方針

- **画面フロー / 導線**: キャンセルは Todo 行のアクション（デスクトップ: 行内ボタン群、モバイル: 長押しメニュー）から 1 タップ。チケットのキャンセルは既存のステータス変更 UI（行メニュー「▸ ステータス」・詳細画面 StatusCell）に candidates として自動で現れる。
- **主要操作とフィードバック**: キャンセル成功 → 行が非表示化（showDone OFF 時）。失敗 → 既存の updateFailed Notice。
- **状態設計**: cancelled Todo は showDone ON のときのみ取り消し線+グレーで表示・checkbox は disabled（誤トグル防止。解除はメニューから）。0 件時・ローディングは既存表示を変更しない。
- **既存デザインシステムとの整合**: バッジ色は既存 `pos-status-done` を再利用。新規クラスは `.pos-todo-cancelled` の 1 つだけ（Rule of Three: done 側に取り消し線の前例が webapp にあり、意味論も同一）。

### レスポンシブ / アクセシビリティ

- 対象端末: デスクトップ + Obsidian モバイル（既存 `body.is-mobile` / `@container` 対応を変更しない）。キャンセル導線はモバイルでは長押しメニュー（既存パターン踏襲・44px タップ領域は既存メニュー UI に準拠）。
- a11y: cancelled 行の checkbox に `aria-disabled` と `aria-label`（「キャンセル済み」を含む）を付与。取り消し線は色のみに依存しない表現（line-through）。

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| setCancelled が conflict（E003）で失敗 | 既存 Notice `manage.updateFailed` を表示・表示状態は store 再 index で巻き戻る（StatusCell と同じ方針） |
| Dataview 未導入（todoFeatures=false） | Todo 一覧自体が既存の degradation に従い非表示（本変更で追加挙動なし） |

## テストケース（技法注記付き）

- [代表値] kanbanData: ticket モードの列に `cancelled` と `archived` が含まれない / project モードの列は従来どおり
- [代表値] todoMenuBuilder: open Todo → 「キャンセル」項目あり / cancelled Todo → 「キャンセル解除」項目あり・「キャンセル」なし
- [代表値] dashboardData: cancelled Todo（今日 due）が todayTodos / openTodosCount に入らない
- [代表値] badgeStyles: `statusColorClass("cancelled")` → `pos-status-done`
