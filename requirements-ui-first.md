# Obsidian Personal OS Plugin UIファースト操作 要件定義書 v1.0

- 版数: v1.0
- 作成日: 2026-07-04
- 親文書: 要件定義書 v2.0(requirements.md)
- 位置づけ: MVP(Phase 1〜7)完了後の第1次機能追加

---

## 1. 概要

### 1.1 目的

MVPは「Markdownを正とし、プラグインは読み取り+整形+書き戻し」という設計を実現したが、**日常操作の多くはまだノート(.md)を直接開いて編集する前提**になっている(例: priority/dueの変更、Blockerの追加、Ticket内へのTodo追加、tags/labelsの編集)。

本機能追加の目的は、**日常の管理操作をすべてプラグインUIで完結させる**ことである。ユーザーがMarkdownファイルを直接開くのは「本文を書くとき」だけにし、構造化された操作(プロパティ変更・状態遷移・Todo操作)はUIから行えるようにする。

### 1.2 基本原則

- **Markdown First は不変**: データの正はこれまで通り `.md` ファイル。UIはあくまで操作の入り口であり、UIで行った操作は既存の安全な書き込みAPI(processFrontMatter / vault.process / renameFile)を通じてMarkdownへ反映される
- **UIとエディタの等価性**: UIでできる操作はすべてMarkdown直接編集でも可能なまま維持する(UIでしか変更できない状態を作らない)
- **既存Serviceの再利用**: 新しい書き込みロジックは原則追加しない。UIは既存のEntityService / TodoService / PromoteService / ReviewService の呼び出し口を増やすものとする

### 1.3 スコープ

本書のスコープは次の2本柱:

- **A. 統合管理View**(新規): Project / Ticket / Todo をタブ切替の一覧で絞り込み・ソートし、その場で操作する画面
- **B. エンティティ詳細編集**(既存Preview強化): 1つのEntityの全プロパティ・Blocker・配下Todoを閲覧だけでなく**編集**できる画面

スコープ外(将来拡張):

- 一括選択・一括操作(複数行まとめてstatus変更等)
- Goal専用タブ(Goalの一覧管理はDashboard/詳細編集で対応。Kanban対象外の方針も維持)
- 列カスタマイズ・ページネーション・仮想スクロール
- 本文(自由記述部分)のUI編集(本文はノートを開いて書く)

---

## 2. A. 統合管理View

### 2.1 View形態

| 項目 | 内容 |
|---|---|
| 形態 | Obsidian ItemView(メインペイン)+ Svelte |
| ViewType ID | `pos-manage` |
| タブ | Projects / Tickets / Todos の3タブ |
| 起動 | コマンド `open-manage` + リボン + Dashboard Widgetからの導線(任意) |
| 状態保持 | タブ・フィルタ・ソートはView生存中保持。SavedViewとして保存可(§2.5) |

- Todosタブは機能制限モード(Tasks/Dataview無効)では非表示+案内バナー(requirements.md §3準拠)

### 2.2 一覧表示

**Projectsタブ**

| 列 | 内容 | 編集 |
|---|---|---|
| Title | ノート名。クリックで詳細編集(§3)を開く | インライン編集(=rename、wikilink自動更新) |
| Status | バッジ+ドロップダウン | 直接変更 |
| Goal | 親Goalタイトル | ドロップダウン(選択/解除) |
| Priority | high/medium/low | ドロップダウン |
| Progress | バー+数値 | 編集不可(自動計算) |
| Due | YYYY-MM-DD | date input |
| Labels | チップ | 詳細編集(§3)で編集 |

**Ticketsタブ**: 同構成。Goal列の代わりにProject列(ドロップダウン)。

**Todosタブ**

| 列 | 内容 | 編集 |
|---|---|---|
| ✓ | 完了チェックボックス | トグル(`✅` 日付付与/除去) |
| Text | 本文(メタデータ除去後) | インライン編集(メタデータ保持) |
| 所属 | 親ノートtitle+typeバッジ | 編集不可(移動は昇格で) |
| Priority | `[priority::]` | ドロップダウン |
| Due | `📅` | date input |

- 表示対象: archived以外のEntity全件(archivedはフィルタ明示時のみ)/ Todoは未完了デフォルト(完了済みはトグルで表示)
- `index-updated` 購読で自動再描画(既存100msデバウンスパターン)
- 0件時は空状態メッセージ+新規作成ボタン

### 2.3 フィルタ・ソート

| フィルタ | 対象タブ | UI |
|---|---|---|
| キーワード | 全部 | text input(title/本文部分一致) |
| Status | Projects/Tickets | 複数選択チップ |
| Priority | 全部 | 複数選択チップ |
| Goal / Project | 該当タブ | ドロップダウン |
| 期間 | 全部 | プリセット: 今日 / 今週(本日〜7日後)/ Overdue / 期限なし |
| Tags / Labels | 全部 | ドロップダウン(既存値から候補生成) |
| 完了済み表示 | Todos | トグル(デフォルトOFF) |

- 判定ロジックは既存 `domain/query.ts` / `domain/judge.ts` を再利用(意味論はrequirements.md §9・§25と同一)
- ソートキー: due / priority / title / progress / 更新日時(Todosは due/priority/text/所属)。列ヘッダクリックで昇順/降順。デフォルトはKanban列内ソートと同一(priority→due→title)

### 2.4 直接操作

| 操作 | 実現方式 |
|---|---|
| Status変更 / Todo完了 | 既存EntityService.changeStatus / TodoService.toggle |
| priority/due/goal/project変更 | processFrontMatter(既存updateFrontmatter) |
| Title変更 | renameFile(wikilink自動更新)。禁止文字は既存ルール置換 |
| Todoのtext/due/priority変更 | editLine(既存)。不一致時は既存E003フロー |
| 新規作成 | ヘッダ「+ 新規」→ 既存CreateEntityModal / QuickAddModal(現在のフィルタ状態を初期値に引き継ぐ) |
| 昇格 / Archive / 削除 | 行メニュー(ホバー、モバイルは「⋮」)→ 既存Modal/Service。削除は確認ダイアログ |

- インライン編集: Enter/フォーカスアウトで確定、Escで取消。失敗時はNotice+元値へ戻す(楽観的更新+ロールバック)

### 2.5 SavedView連携

- タブ+フィルタ+ソートをSavedViewとして保存・復元できる
- SavedView型を後方互換で拡張: `viewMode` に `"manage"` 追加、`tab` を任意フィールドで追加。既存 `"list"` / `"kanban"` の動作は不変

---

## 3. B. エンティティ詳細編集(Preview強化)

### 3.1 位置づけ

既存PreviewView(右サイドペイン、閲覧専用)を**編集可能な詳細パネル**へ強化する。Goal / Project / Ticket すべてが対象。

- 表示トリガ: 既存のactive-leaf-change連動に加え、管理View/Kanban/Dashboardの項目から「詳細を開く」で表示
- ノートを開かずに、そのEntityの構造化情報をすべて閲覧・編集できる状態にする

### 3.2 編集対象

| セクション | 内容 | 操作 |
|---|---|---|
| プロパティ | status / priority / due / start / review_cycle / goal / project | 各フィールドのUI編集(ドロップダウン/date input)。processFrontMatter経由 |
| Title | ノート名 | インライン編集(rename) |
| Tags | frontmatter tags | チップUI(追加/削除。既存タグからサジェスト) |
| Labels | frontmatter labels | チップUI(追加/削除) |
| Blockers | frontmatter blockers | リストUI(追加/編集/削除。自由文字列+wikilink文字列可) |
| Todo | 配下Todo一覧 | 完了トグル / **その場で新規Todo追加**(ノート末尾Todoセクションへ追記)/ 削除 / 昇格 |
| 配下Entity | Goal→Projects、Project→Tickets | 一覧表示+status変更+「+ 新規」(親を初期セットしたCreateEntityModal) |
| Review | 直近レビュー情報(last_reviewed / cycle) | 「レビュー実施」ボタン → 既存ReviewModal |
| 操作 | Archive / 昇格(Ticketのみ)/ 削除 | ボタン(既存Service呼び出し。確認あり) |
| 未知プロパティ | extra | 閲覧のみ(改変禁止の原則維持) |

- 「その場でTodo追加」は本文の `## Todo` セクション末尾(なければ作成)へ追記する。行フォーマットは既存buildTodoLineを使用

### 3.3 本文の扱い

- 本文(自由記述)は詳細パネルでは**プレビュー表示のみ**(先頭N行+「ノートで開く」リンク)
- 本文を書きたいときだけノートを開く、という役割分担を明確にする

---

## 4. 機能制限モード・エラー処理

- Todo系操作(Todosタブ / 詳細のTodoセクション / Todo追加)は `capability.todoFeatures` false時に無効化+案内バナー(E001準拠)
- Entity系操作(プロパティ編集・status変更・Blocker・Archive等)はcapability無関係に動作する
- 解析エラーノートは管理View一覧に表示しない(ParseErrorWidget集約を維持)。ただし詳細パネルで該当ノートを開いた場合はエラー理由を表示する
- インライン編集の書き込み失敗・行不一致は既存のNotice+ロールバック/E003フローに従う
- 全UI文言は `i18n/ja.ts` 集約(既存パターン)

---

## 5. 非機能要件

- 一覧・詳細の描画はIndexStore読み出しのみ(表示時のファイルI/Oなし。詳細の本文プレビューのみcachedRead可)
- 書き込みは既存SelfWriteGuard/デバウンス機構に乗せ、無限ループ・過剰再描画を起こさない
- 1タブ500行程度まで体感遅延なし(超過時の仮想化は将来検討)
- モバイル: タップで全機能操作可能(インライン編集はタップ→編集モード、行メニューは「⋮」)
- デスクトップ: キーボード操作(Tab移動/Enter確定/Esc取消)対応
- UIで書き込んだ結果のMarkdownは、手書きした場合と同一フォーマットになる(Git差分の一貫性)

---

## 6. 受け入れ基準

1. 管理Viewを開き、Projects / Tickets / Todos をタブ切替で一覧できる
2. フィルタ(キーワード/status/priority/親/期間/tags/labels)とソートが機能する
3. 一覧上でstatus変更・Todo完了トグルができ、Markdown/ActivityLogに反映される
4. 一覧上でtitle / priority / due / 親をインライン編集でき、正しく書き戻される(titleはwikilink自動更新)
5. 一覧から新規作成・昇格・Archive・削除ができる
6. タブ+フィルタ+ソートをSavedViewとして保存・復元できる(既存SavedViewは不変)
7. 詳細パネルでEntityの全標準プロパティ・tags・labels・blockersをUI編集できる
8. 詳細パネルから配下Todoの完了・追加・削除・昇格ができる
9. 詳細パネルから配下Entityの確認・作成・status変更、レビュー実施、Archive/昇格/削除ができる
10. 未知のfrontmatterプロパティがUI編集後も保持される
11. UIで書いたMarkdownが手書きと同一フォーマットになる
12. Tasks/Dataview無効時、Todo系のみ無効化され、Entity系は全て動作する
13. 外部でノートを編集した際、一覧・詳細が自動で最新化される
14. モバイルでタップ操作により全機能が利用できる
15. **上記により、日常の管理操作(プロパティ変更・状態遷移・Todo運用・レビュー・Archive)がノートを直接開かずに完結する**

---

## 7. 既存文書への影響

- requirements.md(v2.0): 変更なし(本書は追補として独立)
- design.md / detail-design.md: 本機能の基本設計・詳細設計を別途追補する(次工程)
- SavedView型拡張(§2.5)・PreviewView改修方針(§3)は設計工程で確定する
