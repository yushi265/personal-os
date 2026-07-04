# Personal OS 実機確認チェックリスト

テストVault: `test-vault/`(リポジトリ直下、gitignore済み)
開き方: Obsidian → Vaultスイッチャー →「フォルダをVaultとして開く」→ `test-vault/` を選択 → コミュニティプラグイン有効化を承認(dataview / obsidian-tasks-plugin / personal-os が有効になる)

プラグイン更新の反映: `npm run build` 後に `cp main.js styles.css test-vault/.obsidian/plugins/personal-os/` → Obsidianでプラグインを再読み込み(またはVault再起動)

## 起動・インデックス

- [ ] 起動時にエラーNoticeが出ない(コンソールにエラーなし)
- [ ] リボンのダッシュボードアイコンから Dashboard が開く
- [ ] ParseErrorWidget に「壊れたノート.md」(type: banana)が1件表示される

## Dashboard Widget

- [ ] Today's Todo: 📅本日以前の未完了Todoが出る(SBI銀行へ電話する / 比較表を作る / 図書館の本を返す)
- [ ] Overdue: Todo「SBI銀行へ電話する(7/1)」「図書館の本を返す(7/3)」+ Ticket「住宅ローン比較」(due 7/1超過)が出る
- [ ] Review Needed: 「住宅購入」(weekly, last 6/20)と「キャリア」(last_reviewedなし)が出る
- [ ] Blocked: 「引っ越し準備」(blockers 2件)が出る
- [ ] Active Projects: 「住宅購入」がprogressバー付きで出る
- [ ] Todoのチェックボックスをクリック → ノート側の行が `- [x] ... ✅ 2026-07-04` になる
- [ ] Widget項目クリックで該当ノートが開く

## progress自動計算

- [ ] 「住宅ローン比較」のfrontmatterに progress: 25(4件中1件完了)が書き戻される
- [ ] Todoを1件完了にすると progress が 50 に更新され、親「住宅購入」のprogressも変わる
- [ ] 未知プロパティ(キャリア.md の `energy: high`)が書き戻し後も消えない

## Kanban

- [ ] open-kanbanコマンドでKanbanが開く(ticket列: Backlog/Ready/Doing/Waiting/Review/Done)
- [ ] カードD&Dで列移動 → frontmatterのstatusが変わる → ActivityLogに記録される
- [ ] project表示に切り替えると「資格取得」がBacklog列に出る
- [ ] カードに priority / due / progressバー / blockerバッジが表示される

## 操作系

- [ ] QuickAdd(create-todoコマンド): Inboxに追記される。📅とpriority付きで
- [ ] Create Ticket: テンプレート `ticket-default` 選択で {{title}} {{date}} が置換される
- [ ] Promote Todo to Ticket: Todo行にカーソル→コマンド実行→新Ticket生成+元行がリンク化/完了/削除される
- [ ] Promote Ticket to Project: 「ポートフォリオ更新」がProjects/へ移動しtype=projectになる
- [ ] Archive Entity: ノートがArchive/へ移動、status=archived、archived_at付与、他ノートのwikilinkが自動更新される

## Review / 検索 / Timeline / Export

- [ ] open-review(住宅購入を開いた状態で): ReviewModal→提出でReviews/にノート生成+last_reviewed更新
- [ ] open-search: `type:ticket status:doing` で「住宅ローン比較」だけヒット。SavedView保存→復元できる
- [ ] open-timeline: start/dueを持つ「住宅購入」が横棒表示される
- [ ] export-ai-context / export-ai-summary: クリップボードにMarkdownがコピーされ、「ポートフォリオ更新」がUnlinkedに入っている

## 機能制限モード

- [ ] Dataviewを無効化して再起動 → E001 Notice+Dashboardに案内バナー、Todo系Widget非表示、Entity系は動作継続
- [ ] 再有効化 → 全機能復帰

## モバイル(後日)

- [ ] iOS/AndroidでVault同期して起動
- [ ] Kanbanカードの「⋮」ボタン→status変更メニューの操作感(設計書の「タップ→Menu」との差分評価)
- [ ] UI崩れがないか

## 性能(後日・任意)

- [ ] 大規模Vault(5,000ノート級)で起動3秒以内・差分更新50ms以内(design.md §9.1)
