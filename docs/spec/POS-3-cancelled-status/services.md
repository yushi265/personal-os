# POS-3: services 詳細設計

> レイヤー規約: domain + infra を orchestrate・Obsidian API 直接参照禁止（[architecture.md](../../architecture.md)）。
> webapp 向け HTTP 契約（`src/server/ApiRouter.ts`）は services へ委譲する薄い口のため、本ファイルで一緒に扱う。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-1**: `cancelled` がチケットの有効ステータスになる: `parseEntity` が受理し、`POST /api/entity/status` で `cancelled` へ変更・復帰でき、変更後もエンティティが一覧APIに返る
- **AC-5**: Todo をキャンセル/解除できる: `PATCH /api/todos/cancel` が対象行を `- [-]` / `- [ ]` に書き換え、webapp（TodoListPanel）とプラグイン（TodoList）のUIから操作できる
- **AC-6**: 進捗計算が cancelled を母数から除外する: done 2件・cancelled 1件・未完了 1件のチケット進捗は 67%、全件 cancelled のチケットは 0%。cancelled チケットはプロジェクト進捗の集計から除外される
- **AC-7**: cancelled が「残作業」に数えられない: 今日のTODO・Overdue・未完了数（ダッシュボード/summary API）から cancelled Todo が除外され、cancelled チケットは Overdue 判定されない

## このレイヤーが公開する契約（外部インターフェース）

### HTTP API（ApiRouter・webapp 向け）

| 操作 | パス | 入出力・型・制約 | 認証 | 用途 |
|------|------|-----------------|------|------|
| 追加 | `PATCH /api/todos/cancel` | body: `{ todo: Todo, cancelled: boolean }` → 200 `{ok:true}` / 409 `{error:"E003",code:"E003"}` / 400 | Bearer（既存 AuthGuard） | Todo のキャンセル/解除 |
| 変更なし | `POST /api/entity/status` | `next: "cancelled"` が `validStatusesOf` 経由で自動許可（コード変更なし・テストで固定） | 同上 | チケットのキャンセル |

### Service メソッド

| 操作 | 名前 | 契約 | 用途 |
|------|------|------|------|
| 追加 | `TodoService.setCancelled(todo: Todo, cancelled: boolean): Promise<TodoWriteResult>` | `expected = rebuildTodoLine(todo)`・`next = setTodoLineCancelled(expected, cancelled)`・`repo.editLine(...)`。戻り値は既存 toggle/remove/updateInline と同じ `"ok" \| "conflict"`（ApiRouter の 409 変換に必要） | 行の `[-]` / `[ ]` 書き換え |
| 変更 | `EntityService.changeStatus` | 既存の `next==="done" && ticket` の祖先 progress 再計算に加え、`next==="cancelled"` または変更前 status が `"cancelled"` の ticket でも `recalcAncestors` を発火 | AC-6 の親進捗即時反映 |
| 変更 | `ProgressService` の子チケット収集 | プロジェクト進捗の集計対象から `status === "cancelled"` のチケットを除外（archived 除外と同列） | AC-6 |
| 変更 | `ExportService.countOpenTodos` | `!done && !isCancelledTodo(todo)` | AC-7（AI Export の未完了数） |
| 変更 | `ApiRouter.handleSummary` | todayTodos / overdueTodos から cancelled Todo を除外（overdue は judge 述語の変更に自動追随・todayTodos は明示条件追加）。※`openTodosCount` は summary レスポンスに存在しないフィールド（ui 側 dashboardData のみ・[ui.md](./ui.md) 担当）のため対象外 | AC-7 |

## このレイヤーが依存する下位の契約（呼び出す相手）

- domain: `rebuildTodoLine` / `setTodoLineCancelled` / `isCancelledTodo` / `isTodoOverdue` / `calcTicketProgress`（[domain.md](./domain.md) が正本）
- infra: `VaultRepository.editLine`（完全一致照合 + conflict＝E003。既存契約のまま）

## 実装配置

- `src/services/TodoService.ts` — setCancelled 追加
- `src/services/EntityService.ts` — changeStatus の recalc 条件拡張
- `src/services/ProgressService.ts` — cancelled チケット除外
- `src/services/ExportService.ts` — countOpenTodos
- `src/server/ApiRouter.ts` — `/api/todos/cancel` ルート追加・summary の除外

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| cancel 対象行がファイル上で変更済み（照合不一致） | `editLine` が conflict → ApiRouter が 409 `E003`（既存 toggle と同じ変換） |
| body 不正（todo 欠落・cancelled 非 boolean） | 400（既存の badRequest 変換に従う） |
| 不正 status（`POST /api/entity/status` に未知値） | EntityService が throw → 400（既存挙動・cancelled が「通る」側になることをテストで固定） |

## テストケース（技法注記付き）

- [状態遷移] TodoService.setCancelled(todo, true): mock repo の行が `- [ ] x` → `- [-] x` / (todo, false): `- [-] x` → `- [ ] x`
- [代表値] setCancelled: done Todo（`- [x] x ✅ 2026-01-01`）を cancel → `- [-] x`（✅除去）
- [代表値] setCancelled: 行不一致 → editLine conflict がそのまま伝播（握りつぶさない）
- [代表値] EntityService.changeStatus("cancelled")・ticket → recalcAncestors 呼び出しあり / cancelled→doing（復帰）でも呼び出しあり / project の status 変更では発火しない（既存挙動維持）
- [代表値] ProgressService: 子チケット3件中1件 cancelled → プロジェクト進捗は残り2件の平均
- [レイヤー内結合] ApiRouter: `PATCH /api/todos/cancel` 正常 200 / conflict 409 E003 / body不正 400
- [レイヤー内結合] ApiRouter: `POST /api/entity/status` で `cancelled` → 200・`GET /api/entities?type=ticket` に当該 entity が含まれる
- [レイヤー内結合] ApiRouter.handleSummary: cancelled Todo（期限切れ due 付き）が todayTodos / overdueTodos のいずれにも入らない
