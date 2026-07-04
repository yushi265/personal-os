# Personal OS 実装 TODO

## 第2次機能追加: ドリルダウンナビゲーション(design-drilldown-nav.md v1.0 準拠)

- [x] Phase N1: ナビ基盤(manageNav.ts)+プロジェクト一覧(Goalグルーピング)+ テスト18件(累計186件)→ commit `f2a1a37`
- [x] Phase N2: プロジェクト詳細+TodoList共通部品化(Preview改修込み)+ テスト7件(累計193件)→ commit `f76d1c2`
- [x] Phase N3: チケット詳細+Dashboard遷移+自動巻き戻し配線 + テスト5件(累計198件)→ commit `117ea48`
- [x] Phase N4: 仕上げ(SavedView互換・capability・受け入れ基準12項目チェック)→ commit `645e497`(累計199件)

### ドリルダウンナビゲーション 完了レビュー(2026-07-04)

- 全4 Phase完了。テスト199件全パス、tsc+svelte-check 0エラー0警告、本番ビルド成功。テストVault反映済み
- 受け入れ基準12項目: 10項目○ / 2項目△(実機確認要: #11 外部編集の自動反映、#12 モバイルタップ)
- N4でSavedView旧tab互換のpicker絞り込み漏れを発見・修正(設計§5.2)。タブ式時代の死んだコードパスも一掃
- 実機確認の観点: Goalグルーピングの見た目 / パンくず・戻るの操作感 / Dashboard→詳細ジャンプと↗ボタン / 外部編集の反映 / モバイルタップ領域

## 第1次機能追加: UIファースト操作(design-ui-first.md v1.0 準拠)

- [x] Phase A1: 共通基盤(updateTodoLine/appendTodoToSection/query period拡張/renameNote/EntityFieldService)+ テスト31件(累計137件)→ commit `43408a4`
- [x] Phase A2: 管理View一覧+フィルタ+ソート(読み取り専用)+ テスト16件(累計153件)→ commit `788608b`
- [x] Phase A3: インライン編集+行メニュー+SavedView連携 + テスト8件(累計161件)→ commit `4622bb0`
  - UXメモ: Titleクリックは「編集」に変更(ノートを開くのはRowMenu経由)。実機確認時に使用感を評価
- [x] Phase B1: Preview編集化(プロパティ/Tags/Labels/Blockers)+ テスト5件(累計166件)→ commit `7f811ca`(+NULバイト修正 `d96237b`)
- [x] Phase B2: Todo追加・配下Entity・Review・本文プレビュー + テスト2件(累計168件)→ commit `fea0a0c`
- [x] 仕上げ: capability分岐・i18n総点検・受け入れ基準15項目チェック → commit `1e35e43`

### UIファースト操作 完了レビュー(2026-07-04)

- 全6 Phase完了。テスト168件全パス、tsc+svelte-check 0エラー0警告、本番ビルド成功。テストVaultへ反映済み
- 受け入れ基準15項目: 11項目○ / 4項目△(実機確認要: #11 Git差分の見た目、#13 外部編集の自動反映、#14 モバイルタップ、#15 総合)
- 実機確認の観点:
  - Todoインライン編集でメタデータ順序が正規化される仕様(設計§9.2-7)の差分確認
  - TagChips/BlockerListの×ボタンのタップ当たり判定が小さい懸念(静的指摘)
  - ManageのTitleクリック=編集(ノートを開くのはRowMenu経由)の使用感

## MVP 実装 TODO(完了)

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
