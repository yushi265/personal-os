# POS-3: チケット・TODO のキャンセルステータス

> 薄い実装 spec の入口。読み手は人間（Gate 1/2/3 承認者）。AI 実装エージェントはレイヤー別 `.md` を読む。

## 概要

チケットに終端ステータス `cancelled` を、TODO（Markdown チェックボックス）にキャンセル状態 `- [-]` を追加する。
どちらも done と同様に一覧でデフォルト非表示とし、「完了・キャンセルを表示」チェック（1つに統合）で表示する。
`- [-]` 行が現状「編集・削除すると必ず E003 conflict になる」潜在バグの修正を含む。

## 対象範囲

- 対象レイヤー:
  - [domain.md](./domain.md) — TICKET_STATUSES 拡張・CLOSED 判定・Todo の statusChar・進捗/Overdue/Export の意味論
  - [infra.md](./infra.md) — DataviewAdapter の checkbox 文字読取・settings 既定値と補完
  - [services.md](./services.md) — TodoService のキャンセル操作・API 契約（`PATCH /api/todos/cancel`）・集計除外
  - [ui.md](./ui.md) — Kanban 列除外・バッジ色・プラグイン TodoList のキャンセル導線と非表示・i18n ラベル
  - [webapp.md](./webapp.md) — 一覧の cancelled 非表示・TodoListPanel のキャンセル導線・スタイル
- 対象ドメイン: entity（ticket）・todo・progress・judge・export
- 対象外（やらないこと）:
  - Project エンティティへの cancelled 追加（依頼はチケットと TODO のみ）
  - プラグイン Manage 一覧の done エンティティ非表示化（現状 done を隠していない。既存仕様のまま・別件）
  - Timeline からの cancelled 除外（archived と同様に表示継続）
  - `- [-]` 以外のカスタムチェックボックス文字（`[/]` 等）への意味付け（statusChar 保全により E003 は解消されるが、UI 上は未完了扱いのまま）
  - 検索クエリ言語への Todo 状態フィルタキー追加

## ユニット計画

| # | ユニット | 含む AC | 依存 | 状態 |
|---|---------|--------|------|------|
| 1 | チケット cancelled ステータス | AC-1,2,3,10 | — | 未着手 |
| 2 | TODO キャンセル状態 | AC-4,5,6,7,8,9 | — | 未着手 |

## 受け入れ基準（AC）

- [ ] **AC-1**: `cancelled` がチケットの有効ステータスになる: `parseEntity` が受理し、`POST /api/entity/status` で `cancelled` へ変更・復帰でき、変更後もエンティティが一覧APIに返る
- [ ] **AC-2**: webapp のプロジェクト一覧・チケット一覧・プロジェクト詳細のチケット表で、`status: cancelled` の行が done と同様デフォルト非表示になり、「完了・キャンセルを表示」チェックONで表示される（チェックボックスは1つに統合）
- [ ] **AC-3**: Kanban（ticketモード）の列に cancelled が生成されない（archived と同様）。詳細画面・行メニューのステータス候補には cancelled が出る
- [ ] **AC-4**: `- [-] ` で始まる Todo 行が cancelled として索引され（`done: false`）、その行の編集・削除・並び替えが E003 conflict にならず成功する（既存潜在バグの修正）
- [ ] **AC-5**: Todo をキャンセル/解除できる: `PATCH /api/todos/cancel` が対象行を `- [-]` / `- [ ]` に書き換え、webapp（TodoListPanel）とプラグイン（TodoList）のUIから操作できる
- [ ] **AC-6**: 進捗計算が cancelled を母数から除外する: done 2件・cancelled 1件・未完了 1件のチケット進捗は 67%、全件 cancelled のチケットは 0%。cancelled チケットはプロジェクト進捗の集計から除外される
- [ ] **AC-7**: cancelled が「残作業」に数えられない: 今日のTODO・Overdue・未完了数（ダッシュボード/summary API）から cancelled Todo が除外され、cancelled チケットは Overdue 判定されない
- [ ] **AC-8**: Todo 一覧（webapp: TodoListPanel / Todos / Inbox、プラグイン: TodoList）で cancelled Todo がデフォルト非表示になり、表示チェックONで取り消し線+グレーで表示される
- [ ] **AC-9**: AI Export が cancelled Todo を `- [-]` として出力し、キャンセル情報を失わない
- [ ] **AC-10**: `kanbanColumnNames.ticket` に cancelled の既定ラベルが追加され、cancelled キーを持たない既存 data.json でも読み込み時に補完されて設定タブに列名行が出る

## アーキテクチャ / レイヤー間フロー

```
ステータス変更:  webapp/StatusSelect ─ POST /api/entity/status ─ EntityService.changeStatus ─ validStatusesOf(domain) ─ frontmatter書込
Todoキャンセル:  webapp/TodoListPanel ─ PATCH /api/todos/cancel ─ TodoService.setCancelled ─ rebuildTodoLine(domain) ─ vault.process
索引:           Dataview STask.status(文字) ─ DataviewAdapter.toTodo ─ Todo.statusChar ─ IndexStore ─ 両UI
```

- ステータス値の正本は `src/domain/entity.ts`（Tier 1 トリガー `entity-schema`）。
- checkbox 文字の正本は Todo の新フィールド `statusChar`（行復元は常に statusChar を書き戻す = `[-]` 保全 = E003 修正）。

## エラー・ログ方針（横断サマリ）

| シナリオ | domain/services | server | 表示層の挙動 |
|---|---|---|---|
| 不正 status 値の変更要求 | `EntityService.changeStatus` が throw（既存） | 400 | 既存の updateFailed Notice / toast（変更なし） |
| Todo キャンセル時の行不一致 | `editLine` が conflict 検出（既存） | 409 `E003` | 既存の conflict 通知パターンに従う |
| cancelled キー欠落の既存 data.json | 読み込み時に既定ラベルで補完（新規） | — | 設定タブに列名行が表示される |

## テスト戦略

> webapp パッケージ自体はテストランナーを持たない（既存規約: `tsc --noEmit` + build + 実機確認）。ただし
> **`webapp/src/lib/entityFilter.ts` は例外**で、root Vitest の `tests/webapp/entityFilter.test.ts` が直接 import して
> テストする（このための「import 文ゼロ」制約が同ファイルにある）。webapp のその他の担保は共有ロジックを
> domain へ寄せて単体テストし、配線は typecheck と実機確認で行う。

| AC | 単体 | レイヤー内結合 |
|----|------|--------------|
| AC-1 | domain(entity) | server(ApiRouter) |
| AC-2 | domain(CLOSED判定)・webapp(entityFilter・root Vitest) | —（webapp UI は実機確認） |
| AC-3 | ui(kanbanData) | — |
| AC-4 | domain(todo) | services(TodoService) |
| AC-5 | domain(todo)・services | server(ApiRouter) |
| AC-6 | domain(progress) | services(ProgressService) |
| AC-7 | domain(judge)・ui(dashboardData) | server(summary) |
| AC-8 | —（フィルタは各UI内・実機確認） | — |
| AC-9 | domain(export) | — |
| AC-10 | infra(settings補完ヘルパー) | — |

## 既存実装との関係（再利用 / 差分 / 衝突）

- **再利用**: `validStatusesOf` 経由のバリデーション・選択肢生成・ソート順（配列追加だけで API/両UIに自動追従）。done の非表示フィルタ（webapp `entityFilter.ts`）・showDone トグル群・取り消し線スタイル（webapp Todo 行）。
- **差分**: Todo は `done: boolean` の二値で checkbox 文字を保持しない → `statusChar` を追加し行復元の正本にする。
- **衝突（発見済みバグ）**: `rebuildTodoLine` が `[-]` を `- [ ]` に復元するため `editLine` の期待値照合が必ず失敗（E003）。statusChar 化で解消。
- **依存**: `Todo`/`TICKET_STATUSES` は `@domain` エイリアスで webapp と共有（二重定義なし）。プラグインと webapp の同時デプロイが必要（片側新旧で API/型がずれる既知の罠）。

## 実装に効く制約

- frontmatter 書込は `processFrontMatter`、Todo 行編集は `vault.process`（既存経路のみ・新経路を作らない）
- `TICKET_STATUSES` の挿入位置は `done` の後・`archived` の前（ソート順・列順・chip 順がこの位置で決まる）
- done/cancelled は相互排他（cancelled の Todo は `done: false`）
- テスト時の日付比較は ISO 文字列（既存規約）

## 判断根拠 / 未決事項

- **Todo に `statusChar`（checkbox 生文字）を持たせ、行復元の正本にする**: cancelled 専用 boolean だと `[/]` 等の他カスタム文字が引き続き E003 で壊れる。statusChar 保全なら同じ工数でバグのクラスごと直る。却下案: `cancelled: boolean` のみ追加（バグが残る）。
- **cancelled は集計から除外**（Gate 1 で決定 2026-07-09）: 「やらないことにした仕事」は母数に入れない。全件 cancelled は 0 件扱い（=0%）で「TODO なし」と同じ意味論。
- **表示トグルは 1 つに統合**（Gate 1 決定）: 既存キー `manage.filter.showDone` の文言を「完了・キャンセルを表示」へ変更。キー名は変えない（呼び出し 8 箇所の改名リスクを避ける）。
- **Kanban に cancelled 列を出さない**（Gate 1 決定）: archived と同じ除外方式。キャンセルは行メニュー/詳細画面から。
- **cancelled チケットの祖先 progress 再計算**: 集計除外により親の進捗が変わるため、cancelled への遷移・離脱時に既存の done 遷移と同様に recalc を発火する。
- **cancelled のバッジ色は done/archived と同じグレー系を再利用**: 新規カラートークンは作らない（YAGNI）。ラベル文字で区別可能。
- **未決事項**: なし（Gate 1 で全て確定済み。Dataview の `[-]` の status 文字表現は実装時に test-vault で一次確認する = RED の一部）。
