# Personal OS 実装 TODO

## Obsidian UI洗練パッケージ(2026-07-04)

- [x] Phase V1: ビジュアル言語の統一(Dashboard Widget刷新+statライン+Preview整列+共通表示部品)→ commit `900ba61`
- [x] Phase V2: Kanban/Search/Timelineの洗練(カードデザイン/D&Dフィードバック/今日ライン+月グリッド)+ テスト5件(累計343件)→ commit `8631e28`
  - 挙動変更メモ: Kanbanカード・Search結果・Timeline行のクリック=管理View詳細へ(ノートは⋮/修飾クリック — 全画面で操作言語統一)
- [x] Phase V3: モーダル入力体験+モバイル+細部(フォーム/カードレイアウト/トランケーション)→ commit `377fe8d`

### Obsidian UI洗練パッケージ 完了レビュー(2026-07-04)

- V1〜V3完了。テスト343件全パス、0エラー0警告、テストVault反映済み
- 全画面(Dashboard/Manage/Kanban/Search/Timeline/Preview/モーダル5種)で視覚言語・操作言語・空状態の統一をコードレベル確認済み(V3報告のチェック表)
- 実機確認の観点: モーダルのCmd+Enter送信 / 狭幅でのカードレイアウト / KanbanのD&Dフィードバック / Timelineの今日ライン / Dashboardのstatライン・件数ピル

## UX改善パッケージ(全13項目、2026-07-04ユーザー承認)

- [x] Phase U1 クイックウィン: 相対日付+色 / 進捗分数表示 / Undoトースト化 / 行バッジ(⛔💬Todo残)/ Goal集計進捗 + テスト21件(累計247件)→ commit `048b766`
- [x] Phase U2 操作の速さ: エンティティ版クイックスイッチャー / インライン新規作成 / キーボード操作 + テスト11件(累計258件)→ commit `ff531c9`
- [x] Phase U3 迷わなさ+統合: スライドアニメ / スティッキーヘッダー / オンボーディング空状態 / ステータスバー / ホバープレビュー + テスト9件(累計267件)→ commit `6face1b`

### UX改善パッケージ 完了レビュー(2026-07-04)

- 全13項目完了(U1〜U3)。テスト267件全パス、0エラー0警告、テストVault反映済み
- 実機確認の観点: スライドアニメの方向・速度感 / スティッキーヘッダーの重なり / 空Vaultでのオンボーディング表示 / ステータスバー件数とクリック遷移 / Ctrl+ホバープレビュー / Undoトーストのボタン挙動 / キーボード操作(↑↓/Enter/n/Backspace)
- 未実装メモ: 「x」キーのTodoトグル(entity行に対象なしのため意図的スコープ外)/ Widget側ホバープレビュー(任意扱い)

## 第4次機能追加: ブラウザUI(design-browser-ui.md v1.0 準拠、2026-07-04全Phase承認)

- [x] 設計書(design-browser-ui.md)→ commit `b3fff10`
- [x] Phase P1: サーバー基盤+認証+設定(HttpServer/AuthGuard/TokenStore/api/meta)+ テスト16件(累計283件)→ commit `fe1fdd5`
- [x] Phase P2: REST API全面実装(ApiRouter+テスト42件、累計325件)→ commit `e8afeb2`
- [x] Phase P3: webapp基盤+一覧画面(workspaces/Vite/shadcn/ホーム/プロジェクト一覧)→ commit `87a6161`
  - 要検討メモ: ホーム集計がclient側N+1(P5でサーバー集約エンドポイント追加を検討)
- [x] Phase P4: 詳細画面+全操作(EditableCell/Todo/メモ/楽観的更新)→ commit `06b730c`
  - 方式差メモ: ブラウザ版のArchive/削除は確認ダイアログ(Obsidian内はUndoトースト)
- [x] Phase P5: SSE同期+仕上げ(SseHub/切断バナー/api/summary/静的配信/webapp-dist同梱)+ テスト13件(累計338件)→ commit `ffd1356`

- [x] Phase P6 デザイン磨き込み: motion導入(ページ遷移/スタッガー/Todo完了演出/カウントアップ)/ glassmorphismヘッダー / スケルトン / Cmd+Kパレット / SSE接続ドット → commit `7136929`
  - バンドル: gzip 199KB(+37%、motion主因。ローカル配信なので許容)

### ブラウザUI 完了レビュー(2026-07-04)

- P1〜P5全完了。テスト338件全パス、0エラー0警告、webapp同梱ビルド成功、テストVault反映済み
- 受け入れ基準10項目: 8項目○ / 2項目△(#5 双方向即反映・#8 切断バナー→自動復帰 — コード・テスト済みだが実ブラウザ目視が必要)
- 実機確認手順: 設定→Personal OS→「ブラウザUIを有効にする」ON → Notice/「ブラウザで開く」ボタンのURL(トークン付き)で開く
- 方式差(意図的): ブラウザ版のArchive/削除は確認ダイアログ(Undo APIなし)。ホーム集計は/api/summaryでサーバー側集計(N+1解消済み)

## 第3次機能追加: タイムスタンプ付きメモ(requirements-memo.md v1.0 準拠)

- [x] 設計書(design-memo.md)→ ユーザーレビューOK → commit `3cbd81e`
- [x] Phase M1: domain(メモパース/シリアライズ)+ MemoService + テスト24件(累計223件)→ commit `ed6ba67`
- [x] Phase M2: UI(MemoSection共通部品、Ticket/Project詳細+Preview組込)→ commit `edd6f94` + テストVault反映済み(累計223件)

### メモ機能 完了レビュー(2026-07-04)

- M1+M2完了。テスト223件全パス、0エラー0警告。M1で設計書のセクション離脱判定バグをエージェントが発見し修正(パターン2種使い分け)
- 実機確認の観点: 3画面(Ticket詳細/Project詳細/Preview)でのメモ追加・編集・削除 / IME変換確定Enterで誤送信しないか / 手書きメモとの共存 / ノート側の `## Memo` セクションのGit差分

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
