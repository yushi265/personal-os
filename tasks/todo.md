# Personal OS MVP 実装 TODO

計画: ~/.claude/plans/greedy-tumbling-planet.md(詳細設計書 v1.0 準拠)

- [x] Phase 0: スキャフォールド(package.json / tsconfig / esbuild / vitest / manifest)→ ビルド通過 → commit `1ecc56d`
- [x] Phase 1: 基盤(entity/date/settings/EventBus/SelfWriteGuard/VaultRepository/IndexStore/Indexer/EntityService/CreateEntityModal/main.ts/i18n)+ テスト26件 → commit `6b31b59`
- [x] Phase 2: Todo(todo.ts/DataviewAdapter/TasksAdapter/TodoService/QuickAddModal)+ テスト22件(累計48件)→ commit `8ce6074`
- [x] Phase 3: 表示(judge/progress/ProgressService/Dashboard+Widgets/Preview)+ テスト21件(累計69件)→ commit `65ebe48`
- [x] Phase 4: 操作(Kanban/ActivityLog/PromoteService/PromoteModal/コマンド)+ テスト8件(累計77件)→ commit `8f73c98`
  - 逸脱メモ: モバイルKanbanは「カードタップ→Menu」でなく「⋮ボタン→Menu、タップはノートを開く」実装(実機確認時に要評価)
- [x] Phase 5: 補助(query/SearchService/SavedViewService/ReviewService/ReviewModal/Timeline/検索UI)+ テスト19件(累計96件)→ commit `204f580`
- [x] Phase 6: AI Export(ExportService)+ テスト8件(累計104件)→ commit `9029be5`
- [x] Phase 7: 仕上げ(capability制御/ParseErrorWidget/i18n掃除/本番ビルド/受け入れチェック)+ テスト2件(累計106件)→ commit `f3d3073`

## 既知課題(解消済み)

- ~~インデント付きTodoのtoggle/remove: rawTextにインデントが含まれずline-mismatchフォールバック~~ → Phase 7でSTask.position.start.colからインデント復元して解消
- ~~Search.svelteのsvelte-check warning(state_referenced_locally)~~ → Phase 7で解消

## Review

### 結果サマリ
- MVP Phase 1〜7 全実装完了。Vitest 106件全パス、tsc+svelte-check 0エラー0警告、本番ビルド成功(main.js 362KB)
- 受け入れ基準(要件§34)16項目中 15項目○(コードレベル担保)、1項目△(#15 クロスプラットフォームは実機確認待ち)

### Phase 7で発見・修正されたバグ
- Dashboard Overdue Widgetがcapability無効時にWidget全体非表示になっていた(仕様はEntity側due超過の表示継続)→ 修正済み

### 実機確認が必要な項目(コードでは担保不可)
1. iOS/Android実機でのVault同期・Kanban操作(⋮ボタン方式の使用感評価含む)・モバイルUI崩れ
2. capability案内バナーの表示確認(デスクトップ/モバイル)
3. 大規模Vault(5,000ノート級)での起動3秒以内・差分更新50ms以内の実測(design.md §9.1)
4. Tasks/Dataview実プラグインとの連携動作(テストはモックのため)

### テストVaultへの配置手順
`manifest.json` + `main.js` + `styles.css` を `{Vault}/.obsidian/plugins/personal-os/` にコピー → Obsidian設定でコミュニティプラグイン有効化 → Personal OSを有効化

### 補足
- npm audit で開発依存(esbuild<=0.24.2のdevサーバー系)に既知脆弱性あり。本番ビルド・ランタイムには影響なし。対応する場合はesbuildメジャー更新が必要(Phase 0報告参照)
