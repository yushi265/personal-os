# Goal概念の廃止(design-remove-goal.md)

## 決定事項

- Goal概念を廃止し、階層は **Project → Ticket → Todo** の3層とする
- プロジェクトの分類は**ラベル**で行う。Goal単位のグルーピング表示は作らない(既存のラベルフィルタで十分)
- Goal単位の定期レビューは廃止する
- **既存データは非破壊**。移行コマンドで `goal` → `labels` へ変換し、Goalノート自体はArchiveへ退避する。`type: goal` のノートは今後もパース可能(パースエラーにしない)

## 移行手順(移行コマンド `migrate-goals-to-labels`)

1. 全project(archived含む)を走査し、`goal` が設定されていれば goalノートのtitle(未解決時は元のraw文字列。`[[...]]` は角括弧を除去)を `labels` へ追加(重複回避)し、frontmatterから `goal` キーを削除する
2. 全goalノート(`type: goal`)を `status: archived` + `archived_at` を付与してArchive/へ移動する。既に `status: archived` かつArchive/配下にあるものはスキップする
3. 完了Noticeと ActivityLog(`update`)に件数を記録する

冪等性: ①は移行済み(`goal`キーが既に無い)projectを対象にしないため自然に冪等。②はArchive/配下+`archived`済みをスキップすることで、`moveToArchive`の再実行によるファイル名サフィックス衝突(例: `Goal 1.md`)を回避する。

移行ロジックの中核(goal値→label文字列の算出)は `src/domain/migrateGoals.ts` に純粋関数として切り出し、Vault I/O無しで単体テストする。

## 互換方針(既存データ読み書き互換)

Goalノートやgoalフィールドが残っている既存Vaultをパースエラーにしないため、以下は**当面残置**する(G1時点):

- `ENTITY_TYPES` の `"goal"`(`src/domain/entity.ts`)
- `OPEN_STATUSES.goal` / `GOAL_STATUSES` / `parseEntity`のgoal取り込み(`src/domain/entity.ts`)
- `EntityFieldService` の `"goal"` フィールドキー・`reorderAndReassignGoal`(`src/services/EntityFieldService.ts`)
- `ReviewService` のgoal分岐(`decision === "complete" ? "done" : target.type === "goal" ? "paused" : "waiting"`、`src/services/ReviewService.ts`)
- `judge.ts` の `isReviewNeeded`(type別分岐は既にgoal/project/ticketを同列に扱っており変更不要)

G1で撤去したのは `create-goal` コマンド(`main.ts`)のみ。GoalのUI(作成モーダル・詳細画面・Kanban上のgoal列挙等)はG2まで維持する。

## フェーズ分割

- **G1(本ドキュメント範囲)**: 移行コマンド追加、`create-goal`コマンド削除、domain/servicesの互換整理・ドキュメント化。UIはビルドが通る状態を維持し撤去しない
- **G2**: UI撤去(Goal作成モーダル・Goal詳細画面・Kanbanのgoal関連表示・EntitySwitcherのgoal選択・オンボーディングのgoal導線等)、関連i18nキーの整理
- **G3**: `ENTITY_TYPES`等のgoal互換コードそのものを削除するか判断(既存Vaultの移行完了率を見て決定。当面は互換維持を継続する可能性が高い)
