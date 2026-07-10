# POS-3: domain 詳細設計

> レイヤー規約: 純粋関数のみ・Obsidian API 非依存（[architecture.md](../../architecture.md)）。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-1**: `cancelled` がチケットの有効ステータスになる: `parseEntity` が受理し、`POST /api/entity/status` で `cancelled` へ変更・復帰でき、変更後もエンティティが一覧APIに返る
- **AC-4**: `- [-] ` で始まる Todo 行が cancelled として索引され（`done: false`）、その行の編集・削除・並び替えが E003 conflict にならず成功する（既存潜在バグの修正）
- **AC-6**: 進捗計算が cancelled を母数から除外する: done 2件・cancelled 1件・未完了 1件のチケット進捗は 67%、全件 cancelled のチケットは 0%。cancelled チケットはプロジェクト進捗の集計から除外される
- **AC-7**: cancelled が「残作業」に数えられない: 今日のTODO・Overdue・未完了数（ダッシュボード/summary API）から cancelled Todo が除外され、cancelled チケットは Overdue 判定されない
- **AC-9**: AI Export が cancelled Todo を `- [-]` として出力し、キャンセル情報を失わない

## このレイヤーが公開する契約（外部インターフェース）

| 操作 | 名前 | 入出力・型・制約 | 用途 |
|------|------|-----------------|------|
| 変更 | `TICKET_STATUSES`（entity.ts） | `["backlog","ready","doing","waiting","review","done","cancelled","archived"]`（`done` の後・`archived` の前に挿入） | バリデーション・選択肢・ソート・Kanban 列の正本 |
| 追加 | `isClosedStatus(status: string): boolean`（entity.ts） | `status === "done" \|\| status === "cancelled"` → true | 一覧の「デフォルト非表示」判定の共有述語（webapp から `@domain` で import） |
| 変更なし | `OPEN_STATUSES.ticket` | cancelled を**含めない**（終端扱い。テストで固定） | Overdue 判定（judge.isOverdue）が自動で cancelled を除外 |
| 追加 | `Todo.statusChar?: string`（todo.ts） | checkbox の生文字 1 字（`" "` / `"x"` / `"-"` / その他は保全）。**行復元の正本**。optional（欠落時は done からフォールバック = 異常系表と整合・旧クライアント JSON 互換） | `[-]` を含む全カスタム状態の保全（E003 バグ修正の核） |
| 追加 | `isCancelledTodo(todo: Todo): boolean`（todo.ts） | `todo.statusChar === "-"` | 全レイヤー共通のキャンセル判定述語 |
| 変更 | `rebuildTodoLine(todo, opts?)` | checkbox を `- [${statusChar}]` で復元。`statusChar` 欠落/1文字でない場合は `done ? "x" : " "` へフォールバック | editLine の expected 生成（既存呼び出し互換） |
| 変更 | `toggleTodoLine(line)` | 行頭 checkbox が `[-]` の行は**そのまま返す**（no-op）。`[ ]`↔`[x]` は既存挙動 | cancelled 行の誤トグル防止 |
| 追加 | `setTodoLineCancelled(line: string, cancelled: boolean): string` | 行頭 checkbox（インデント許容）を `[-]`（true）/ `[ ]`（false）に置換。true 時は `✅ YYYY-MM-DD` を除去（un-check と同義） | TodoService.setCancelled の行変換 |
| 変更 | `calcTicketProgress(todos)` | `active = todos.filter(t => !isCancelledTodo(t))`。`active.length === 0` → 0。`round(done数 / active.length * 100)` | 進捗の母数から cancelled 除外 |
| 変更 | `isTodoOverdue(todo, today)` | `!todo.done && !isCancelledTodo(todo) && due < today` | Overdue から cancelled 除外 |
| 変更 | `fmtTodoLine`（export.ts） | cancelled → `- [-]`、done → `- [x]`、それ以外 → `- [ ]` | AI Export の情報保全 |

- done と cancelled は相互排他: `statusChar === "-"` の Todo は `done: false`（パース時に infra が保証）。
- `updateTodoLine` / `buildTodoLine` は checkbox 生成を `rebuildTodoLine` と同じ statusChar 規則に揃える（新規作成は `" "`）。

## このレイヤーが依存する下位の契約（呼び出す相手）

- なし（純粋関数のみ）。

## 実装配置

- `src/domain/entity.ts` — TICKET_STATUSES・isClosedStatus
- `src/domain/todo.ts` — Todo.statusChar・isCancelledTodo・rebuild/toggle/update/build・setTodoLineCancelled
- `src/domain/progress.ts` — calcTicketProgress
- `src/domain/judge.ts` — isTodoOverdue
- `src/domain/export.ts` — fmtTodoLine

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| `statusChar` が欠落した Todo オブジェクト（旧クライアント由来の JSON） | `rebuildTodoLine` が `done` から `"x"` / `" "` へフォールバック（throw しない） |
| `statusChar` が 2 文字以上・空文字 | 同上フォールバック（不正値を行へ書き込まない） |
| `setTodoLineCancelled` が checkbox の無い行を受けた | 行をそのまま返す（変換しない。上位の editLine 照合で検出される） |

## テストケース（技法注記付き）

- [同値分割] parseEntity: `status: cancelled` の ticket → ok / `status: not-a-status` → エラー（既存負例の維持）
- [代表値] TICKET_STATUSES の順序: `done` → `cancelled` → `archived` の並び / OPEN_STATUSES.ticket に cancelled が**含まれない**
- [デシジョンテーブル] isClosedStatus: done=true / cancelled=true / doing=false / archived=false / backlog=false
- [状態遷移] setTodoLineCancelled: `- [ ]`→`- [-]` / `- [-]`→`- [ ]` / `- [x] ✅ 2026-01-01`→`- [-]`（✅除去）/ インデント行 `  - [ ]`→`  - [-]`
- [代表値] rebuildTodoLine: statusChar `"-"` → `- [-] …` / `"/"` → `- [/] …`（カスタム文字保全）/ statusChar 欠落+done → `- [x] …`
- [代表値] toggleTodoLine: `- [-] x` → 変更なし（no-op）
- [境界値] calcTicketProgress: todos 0件 → 0 / 全件 cancelled → 0 / done2+cancelled1+open1 → 67 / done3+cancelled1 → 100
- [デシジョンテーブル] isTodoOverdue: (done, cancelled, due) = (F,F,過去)→true / (F,T,過去)→false / (T,F,過去)→false / (F,F,今日)→false / (F,F,なし)→false
- [代表値] fmtTodoLine: cancelled Todo → `- [-] テキスト`
