# Obsidian Personal OS Plugin 基本設計書 v1.0

- 版数: v1.0
- 作成日: 2026-07-04
- 対応要件: 要件定義書 v2.0
- 対象範囲: MVP(要件定義書 §31)

---

## 1. 設計方針

### 1.1 基本原則

| 原則 | 設計への反映 |
|---|---|
| Markdown First | 全データはVault内の `.md` ファイル。プラグインは「読み取り+整形+書き戻し」のみを行い、独自DB・独自バイナリを一切持たない |
| AI First | frontmatterを唯一の構造化レイヤーとする。派生データ(progress等)もfrontmatterへ書き戻し、ファイル単体でAIが状況を理解できる状態を保つ |
| Local First | ネットワーク通信を行わない(MVP)。全処理はローカル完結 |
| Cross Platform | Node.js API(`fs` 等)を直接使用せず、Obsidian Vault API経由でのみファイル操作する。`isDesktopOnly: false` |

### 1.2 技術スタック

| 項目 | 採用技術 | 理由 |
|---|---|---|
| 言語 | TypeScript(strict) | Obsidian Plugin標準。型安全性 |
| UI | Obsidian ItemView + Svelte | Viewペイン系UI(Dashboard/Kanban)の宣言的構築。バンドルサイズが小さくモバイルでも軽量 |
| ビルド | esbuild | Obsidianサンプルプラグイン標準構成に準拠 |
| テスト | Vitest | ドメインロジック(進捗計算・クエリ・パーサ)の単体テスト |
| 依存プラグイン | Tasks / Dataview | Todo記法・インラインフィールドの解釈(要件 §3) |

---

## 2. アーキテクチャ

### 2.1 レイヤ構成

UIとドメインロジックを分離したレイヤードアーキテクチャを採用する。

```
┌─────────────────────────────────────────────┐
│ Presentation層                               │
│  DashboardView / KanbanView / PreviewView   │
│  SettingsTab / Modals / Commands             │
├─────────────────────────────────────────────┤
│ Application層(Service)                      │
│  EntityService / TodoService                 │
│  PromoteService / ReviewService              │
│  ProgressService / ExportService             │
│  ActivityLogService / SearchService          │
├─────────────────────────────────────────────┤
│ Domain層                                     │
│  Entity / Todo / Blocker / SavedView         │
│  ステータス定義・判定ロジック(純粋関数)    │
├─────────────────────────────────────────────┤
│ Infrastructure層                             │
│  VaultRepository(ファイルI/O)              │
│  IndexStore(インメモリインデックス)        │
│  TasksAdapter / DataviewAdapter              │
└─────────────────────────────────────────────┘
```

設計理由:

- Domain層を純粋関数(副作用なしの関数)中心にすることで、Obsidian APIをモックせずに単体テストできる
- Tasks/DataviewへのアクセスをAdapter(外部依存を包む変換層)に閉じ込め、依存プラグイン無効時の機能制限モード(要件 §3)を1箇所で制御する

### 2.2 モジュール構成(ディレクトリ)

```
src/
├── main.ts                 # Plugin本体。ライフサイクル管理
├── settings/
│   ├── settings.ts         # 設定スキーマ・デフォルト値
│   └── SettingsTab.ts
├── domain/
│   ├── entity.ts           # Entity型・status定義
│   ├── todo.ts             # Todo型・パース結果型
│   ├── progress.ts         # 進捗計算(純粋関数)
│   ├── judge.ts            # Overdue/ReviewNeeded/Blocked判定
│   └── query.ts            # Advanced Searchクエリ解釈
├── services/
│   ├── EntityService.ts
│   ├── TodoService.ts
│   ├── PromoteService.ts
│   ├── ReviewService.ts
│   ├── ProgressService.ts
│   ├── ExportService.ts
│   ├── ActivityLogService.ts
│   └── SearchService.ts
├── infra/
│   ├── VaultRepository.ts
│   ├── IndexStore.ts
│   ├── TasksAdapter.ts
│   └── DataviewAdapter.ts
└── ui/
    ├── dashboard/
    ├── kanban/
    ├── preview/
    ├── modals/             # QuickAdd / Create / Promote / Review
    └── components/         # 共通Svelteコンポーネント
```

---

## 3. データ設計

### 3.1 Entityの内部表現

ファイル(frontmatter)⇔ 内部モデルのマッピング。

```typescript
type EntityType = "goal" | "project" | "ticket" | "review" | "resource" | "inbox";

type GoalStatus = "active" | "paused" | "done" | "archived";
type ProjectStatus = "backlog" | "active" | "waiting" | "review" | "done" | "archived";
type TicketStatus = "backlog" | "ready" | "doing" | "waiting" | "review" | "done" | "archived";

interface Entity {
  path: string;              // Vault内パス(一意キー)
  type: EntityType;
  title: string;             // ファイル名(拡張子除く)
  status: string;
  goal?: string;             // wikilink解決後のパス
  project?: string;
  priority?: "high" | "medium" | "low";
  progress?: number;         // 0-100(自動計算値)
  start?: string;            // ISO日付
  due?: string;
  reviewCycle?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  lastReviewed?: string;
  archivedAt?: string;
  tags: string[];
  labels: string[];
  blockers: string[];        // §3.3参照
  extra: Record<string, unknown>;  // 未知プロパティ(保持のみ、改変禁止)
}
```

設計ポイント:

- `extra` に未知プロパティを退避し、書き戻し時に必ず元の位置へ復元する(要件 §8「未知のプロパティは保持する」)
- `goal` / `project` のwikilinkは `MetadataCache.getFirstLinkpathDest()` で解決し、パス文字列で保持する

### 3.2 Todoの内部表現

```typescript
interface Todo {
  filePath: string;          // 所属ノート
  line: number;              // 行番号(編集時の特定に使用)
  text: string;              // 本文(メタデータ除去後)
  done: boolean;
  dueDate?: string;          // 📅
  startDate?: string;        // 🛫
  doneDate?: string;         // ✅
  priority?: "high" | "medium" | "low";  // [priority::]
  labels: string[];          // [labels::]
  parentType: "ticket" | "project" | "inbox";  // 所属ノートのtypeから判定
  parentPath: string;
}
```

- パースはDataviewAdapterのページデータ(`page.file.tasks`)を一次ソースとする
- Dataview無効時は機能制限モード: Todo系Widget/フィルタを非表示にし、案内バナーを表示

### 3.3 Blocker管理方式(設計決定)

**決定: frontmatterの `blockers` 配列で管理する。**

```yaml
---
type: ticket
status: waiting
blockers:
  - "銀行からの回答待ち(7/10予定)"
  - "[[住宅ローン比較]]の完了待ち"
---
```

理由:

1. **AI First**: 本文セクション方式だと自由記述のパースが必要になり、AIにもプラグインにも解釈の曖昧さが残る。frontmatterなら構造が保証される
2. **判定の単純化**: Blocked判定(要件 §9)が `blockers.length > 0` の1条件で済む
3. **Git差分**: 配列の増減が行単位差分にそのまま現れる
4. wikilink文字列を許容することで「他Entityの完了待ち」も表現できる(MVPではリンク解決までは行わず、文字列として表示のみ)

### 3.4 IndexStore(インメモリインデックス)

大規模Vault対応(要件 §30)のため、全ファイル走査を起動時1回に限定し、以降は差分更新する。

```typescript
class IndexStore {
  private entities = new Map<string, Entity>();   // key: path
  private todos = new Map<string, Todo[]>();      // key: parentPath
  private byType = new Map<EntityType, Set<string>>();
  private childrenOf = new Map<string, Set<string>>(); // goal→projects, project→tickets

  upsert(entity: Entity): void { /* 各Mapを更新 */ }
  remove(path: string): void { /* 各Mapから削除 */ }
  getChildren(path: string): Entity[] { /* childrenOfから解決 */ }
}
```

更新トリガ(差分更新):

```typescript
// main.ts
this.registerEvent(
  this.app.metadataCache.on("changed", (file) => {
    if (!this.isUnderRoot(file.path)) return;  // Root Directory外は無視(要件 §4)
    this.indexer.reindexFile(file);            // 1ファイルのみ再解析
    this.progressService.recalcAncestors(file.path); // §4.1参照
    this.eventBus.emit("index-updated");       // 各Viewが購読して再描画
  })
);
this.registerEvent(this.app.vault.on("rename", (f, old) => this.indexer.handleRename(f, old)));
this.registerEvent(this.app.vault.on("delete", (f) => this.indexer.handleDelete(f)));
```

- 起動時のフルスキャンは `MetadataCache` のキャッシュ済みfrontmatterを使い、ファイル本文読み込みを避ける(Todoパースが必要なノートのみ本文アクセス)

---

## 4. 主要ロジック設計

### 4.1 進捗自動計算(ProgressService)

要件 §8 の計算仕様の実装。

処理フロー:

```
ファイル変更イベント
      │
      ▼
変更ノートのtype判定
      │
      ├─ Todoを含むノート(ticket/project/inbox)
      │        │
      │        ▼
      │  ① 所属Ticketのprogress再計算
      │        │
      │        ▼
      │  ② 親Projectのprogress再計算
      │
      └─ ticketのfrontmatter変更(statusなど)
               │
               ▼
         親Projectのprogress再計算
```

ドメインロジック(純粋関数):

```typescript
// domain/progress.ts
export function calcTicketProgress(todos: Todo[]): number {
  if (todos.length === 0) return 0;                    // 要件: Todo 0件は0
  const done = todos.filter(t => t.done).length;
  return Math.round((done / todos.length) * 100);      // 四捨五入
}

export function calcProjectProgress(
  ticketProgresses: number[],
  directTodos: Todo[]        // Project直下のTodo
): number {
  const parts = [...ticketProgresses];
  if (directTodos.length > 0) {
    parts.push(calcTicketProgress(directTodos));       // Ticket 1件相当として平均に含める
  }
  if (parts.length === 0) return 0;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}
```

書き戻し:

```typescript
// services/ProgressService.ts
async writeBack(path: string, progress: number): Promise<void> {
  const file = this.vault.getFileByPath(path);
  if (!file) return;
  await this.app.fileManager.processFrontMatter(file, (fm) => {
    if (fm.progress === progress) return;   // 変更なしなら書き込まない(無限ループ・無駄なGit差分防止)
    fm.progress = progress;
  });
}
```

設計上の注意:

- **無限ループ対策**: 書き戻し自体が `changed` イベントを発火するため、値が同一なら書き込みスキップ+直近の自己書き込みパスを短時間(500ms)抑制リストに入れる
- **手動編集の上書き**(要件 §8): 再計算タイミングで自動値に収束するため、特別な処理は不要

### 4.2 Dashboard判定ロジック(domain/judge.ts)

要件 §9 の判定表をそのまま純粋関数化する。

```typescript
const OPEN_PROJECT = new Set(["backlog", "active", "waiting", "review"]);
const OPEN_TICKET  = new Set(["backlog", "ready", "doing", "waiting", "review"]);

export function isOverdue(e: Entity, today: string): boolean {
  if (!e.due) return false;
  const open = e.type === "project" ? OPEN_PROJECT : OPEN_TICKET;
  return e.due < today && open.has(e.status);
}

export function isTodoOverdue(t: Todo, today: string): boolean {
  return !t.done && !!t.dueDate && t.dueDate < today;
}

export function isReviewNeeded(e: Entity, today: string): boolean {
  if (!e.reviewCycle) return false;
  if (!e.lastReviewed) return true;                    // 一度もレビューしていない
  return addCycle(e.lastReviewed, e.reviewCycle) <= today;
}

export function isBlocked(e: Entity): boolean {
  return e.blockers.length > 0 &&
    (e.type === "project" ? OPEN_PROJECT : OPEN_TICKET).has(e.status);
}
```

- 日付比較はISO文字列(`YYYY-MM-DD`)の辞書順比較で行い、タイムゾーン問題を回避する
- `addCycle` は daily=+1日 / weekly=+7日 / monthly=+1月 / quarterly=+3月 / yearly=+1年

### 4.3 昇格処理(PromoteService)

Todo→Ticket昇格のシーケンス:

```
User: コマンド「Promote Todo to Ticket」実行
  │
  ▼
PromoteModal表示(Ticket名・所属Project・元Todoの扱いを選択)
  │
  ▼
① TemplateからTicketノート生成(Tickets/配下)
② frontmatter設定(type/status=backlog/project/goal継承)
③ 元TodoをTicketノート本文へ移動
④ 元Todo行を選択に応じて処理
     - 削除: 行削除
     - 完了: `- [x]` + ✅日付
     - リンク化: `- [ ] [[新Ticket名]]` へ置換
⑤ ActivityLogへ記録
⑥ IndexStore差分更新 → Dashboard再描画
```

- ②のgoal継承: 所属Projectの `goal` をコピーする(階層整合性の担保)
- ①〜④は失敗時に途中状態が残らないよう、④完了までエラー時はロールバック(生成したノートを削除)する

Ticket→Project昇格も同一パターン(frontmatterの `type`/`status` 変換+配下Todoの持ち上げ)で実装する。

### 4.4 Advanced Searchクエリ(domain/query.ts)

要件 §25 の `key:value` 形式クエリのパーサと評価器。

```typescript
// "type:ticket status:doing priority:high 銀行"
// → { filters: {type:"ticket", status:"doing", priority:"high"}, text: "銀行" }
export function parseQuery(input: string): ParsedQuery {
  const filters: Record<string, string> = {};
  const words: string[] = [];
  for (const token of input.split(/\s+/)) {
    const m = token.match(/^(type|status|priority|tags|labels|due|goal|project):(.+)$/);
    if (m) filters[m[1]] = m[2];
    else if (token) words.push(token);
  }
  return { filters, text: words.join(" ") };
}
```

- `due` は `due:<2026-07-10`(前)、`due:2026-07-10`(一致)の比較演算子付きをサポート
- 全文検索はIndexStoreのタイトル+frontmatter対象。本文全文はObsidian標準の `prepareSimpleSearch()` を利用

### 4.5 AI Export / AI Summary(ExportService)

いずれもルールベース(要件 §23)。IndexStoreから集計してMarkdown文字列を組み立て、`navigator.clipboard.writeText()` でコピーする。

AI Export出力構造:

```markdown
# Personal OS Context (2026-07-04)

## Goals
### 家族 (active, priority: high)
...frontmatter要約...

## Projects
### 住宅購入 (active, progress: 40%, due: -)
- Blockers: なし
- Tickets: 住宅ローン比較 (doing, 20%), 引っ越し準備 (backlog, 0%)

## Overdue
- [ ] SBI銀行へ電話する 📅 2026-07-01 (住宅ローン比較)

## Review Needed
- 住宅購入 (weekly, last: 2026-06-20)
```

AI Summaryは上記のダイジェスト版(件数サマリ+要注意項目のみ)を生成する。

---

## 5. UI設計

### 5.1 View一覧

| View | ViewType ID | 配置 | 実装 |
|---|---|---|---|
| Dashboard | `pos-dashboard` | メインペイン | ItemView + Svelte |
| Kanban(Project/Ticket) | `pos-kanban` | メインペイン | ItemView + Svelte(HTML5 Drag and Drop) |
| Preview | `pos-preview` | 右サイドペイン | ItemView + Svelte |
| Timeline | `pos-timeline` | メインペイン | ItemView + Svelte |

### 5.2 Dashboard

```
┌────────────────────────────────────────┐
│ Personal OS Dashboard        [⚙][↻]   │
├──────────────────┬─────────────────────┤
│ Today's Todo     │ Overdue          🔴 │
│ □ SBI銀行へ電話  │ □ 比較表を作る      │
│ □ ...            │ ▸ 住宅購入 (due超過)│
├──────────────────┼─────────────────────┤
│ Active Projects  │ Review Needed    🟡 │
│ ▸ 住宅購入 ▓▓░ 40%│ ▸ 住宅購入 (weekly) │
├──────────────────┼─────────────────────┤
│ Blocked          │ Recent Updates      │
│ ▸ 引っ越し準備   │ ・住宅ローン比較     │
└──────────────────┴─────────────────────┘
```

- Widgetの表示/非表示・並び順は設定(§7)から制御。並び替えUIは設定画面のドラッグリストで提供
- 各項目クリックで該当ノートを開く/Previewペインに表示
- `index-updated` イベント購読で自動再描画(手動↻も提供)

### 5.3 Kanban

- Project用・Ticket用で列定義を切り替え(要件 §11/§12 のマッピング表に準拠)
- カードD&D確定時: `processFrontMatter` で `status` を更新 → ActivityLog記録
- 列名はカスタマイズ可(設定)だが、**status値との対応関係は固定**(要件 §29)
- モバイル: D&D非対応環境向けに、カードタップ→status選択メニューの代替操作を提供

### 5.4 Modal(入力系UI)

| Modal | 起動元 | 入力項目 |
|---|---|---|
| CreateEntityModal | コマンド/Dashboard | タイトル・type・親(goal/project)・priority・due・テンプレート |
| QuickAddModal | コマンド(ホットキー) | Todo本文・保存先(デフォルト: Inbox)・📅・priority |
| PromoteModal | コマンド/コンテキストメニュー | 新Entity名・親・元Todo/Ticketの扱い |
| ReviewModal | コマンド/Dashboard | Progress・Blocker・Next Action・判断(Continue/Pause/Complete) |

- 親選択はサジェスト付き(`AbstractInputSuggest` 利用)

### 5.5 コマンド定義

要件 §28 の全コマンドを `addCommand` で登録。主要なものにデフォルトホットキーは**設定しない**(ユーザー環境との衝突回避。Community Plugin公開時のガイドライン準拠)。

---

## 6. ファイル操作設計

### 6.1 書き込みAPI方針

| 操作 | 使用API | 理由 |
|---|---|---|
| frontmatter更新 | `app.fileManager.processFrontMatter()` | YAML破壊リスクの回避・未知プロパティ保持が保証される |
| 本文行編集(Todo) | `vault.process()` | アトミックなread-modify-write。同時編集競合を回避 |
| ノート作成 | `vault.create()` | — |
| Archive移動 | `app.fileManager.renameFile()` | wikilinkの自動リンク更新が効く |

### 6.2 Archive処理

```
① status を archived に更新
② archived_at に本日を設定
③ renameFile() で Archive/ へ移動(リンク自動更新)
④ ActivityLog記録
```

### 6.3 Activity Log

- 保存先: `{Root}/Reviews/../` ではなく専用ファイル `{Root}/Archive/activity-log.md` …ではなく、**月次ローテーション**の `{Root}/Logs/2026-07.md` 形式とする
- ※ 要件 §4 のディレクトリ構成に `Logs/` がないため、**構成へ `Logs/` を追加する(要件へのフィードバック事項 §9.1)**
- 追記形式(append only):

```markdown
- 2026-07-04 21:15 [status] 住宅ローン比較: doing → review
- 2026-07-04 21:20 [promote] Todo「比較表を作る」→ Ticket「比較表作成」
```

---

## 7. 設定設計(settings.ts)

```typescript
interface POSSettings {
  rootDirectory: string;            // default: "PersonalOS"
  folders: {
    goals: string;                  // default: "Goals"
    projects: string; tickets: string;
    inbox: string; archive: string;
    templates: string; reviews: string; logs: string;
  };
  dashboard: {
    widgets: { id: WidgetId; visible: boolean }[];  // 並び順=配列順
    recentUpdatesCount: number;     // default: 10
  };
  defaultReviewCycle: ReviewCycle;  // default: "weekly"
  defaultPriority: Priority;        // default: "medium"
  kanbanColumnNames: {              // 表示名のみ変更可。status対応は固定
    project: Record<ProjectStatus, string>;
    ticket: Record<TicketStatus, string>;
  };
  language: "ja";                   // 将来 "en" 追加(UI文言はリソース化)
}
```

- 保存は `loadData()` / `saveData()`(`data.json`)
- UI文言は `src/i18n/ja.ts` に集約(要件 §30 保守性)

---

## 8. エラー処理・機能制限モード

### 8.1 依存プラグインチェック

```typescript
// main.ts onLayoutReady
const dv = this.app.plugins.plugins["dataview"];
const tasks = this.app.plugins.plugins["obsidian-tasks-plugin"];
this.capability = {
  todoFeatures: !!dv && !!tasks,   // false → 機能制限モード
};
if (!this.capability.todoFeatures) {
  new Notice("Personal OS: Tasks / Dataview プラグインが必要です。Todo機能は無効化されています。");
}
```

| 状態 | 動作 |
|---|---|
| 両方有効 | 全機能 |
| いずれか無効 | Todo系(Today's Todo / Overdue(Todo) / Todoフィルタ / QuickAdd / 昇格元Todo処理)を無効化+設定画面に導入ガイド表示。Entity管理・Kanban・Reviewは動作 |

### 8.2 エラーハンドリング方針

- ユーザー操作起点の失敗: `Notice` で通知+`console.error` に詳細
- frontmatterパース不能ノート: インデックスから除外し、Dashboardに「解析エラー(N件)」Widgetで可視化(黙って無視しない)
- 昇格処理: §4.3の通りロールバック実装

---

## 9. 非機能設計

### 9.1 パフォーマンス目標

| 項目 | 目標 |
|---|---|
| 起動時フルインデックス | 5,000ノートで3秒以内(frontmatterはMetadataCacheキャッシュ利用) |
| 差分更新 | 1ファイル変更あたり50ms以内 |
| Dashboard再描画 | 100ms以内(IndexStoreからの読み出しのみ) |

### 9.2 要件定義書へのフィードバック事項

基本設計の過程で判明した、要件定義書v2.0への反映推奨事項:

1. ディレクトリ構成(§4)に `Logs/` を追加(Activity Log保存先)
2. Blocker管理方式をfrontmatter `blockers` 配列に確定(§17の未決事項の解消)
3. Kanban列名カスタマイズは「表示名のみ」であることを明記(§29の補足)

---

## 10. テスト方針

| 対象 | 手法 |
|---|---|
| domain/(progress, judge, query) | Vitestで単体テスト。境界値(Todo 0件、due=本日、cycle跨ぎ)を網羅 |
| services/ | VaultRepository をモック化して結合テスト |
| UI | 手動テスト(デスクトップ3OS+iOS/Androidの実機Vault同期確認) |
| 受け入れ | 要件定義書 §34 の受け入れ基準を1項目ずつチェックリスト化 |

---

## 11. 開発フェーズ計画(MVP内の実装順)

| Phase | 内容 | 依存 |
|---|---|---|
| 1 | 基盤: settings / VaultRepository / IndexStore / Entity CRUD | — |
| 2 | Todo: Adapter / TodoService / QuickAdd | Phase 1 |
| 3 | 表示: Dashboard / Preview / 判定ロジック | Phase 1-2 |
| 4 | 操作: Kanban / 昇格 / Archive / ActivityLog | Phase 3 |
| 5 | 補助: Review / Saved Views / Advanced Search / Timeline | Phase 4 |
| 6 | AI: Export / Summary | Phase 5 |
| 7 | 仕上げ: 機能制限モード / エラー可視化 / モバイル動作確認 | 全Phase |

---

## 付録A. 用語集

| 用語 | 説明 |
|---|---|
| MetadataCache | Obsidianが保持するノートのメタデータ(frontmatter・リンク等)のキャッシュAPI |
| ItemView | Obsidianのペイン内カスタムViewを作るための基底クラス |
| processFrontMatter | frontmatterを安全に読み書きするObsidian公式API。YAML構造を壊さない |
| Adapter | 外部依存(Tasks/Dataview)を自コードから隔離する変換層 |
| 純粋関数 | 同じ入力に対し常に同じ出力を返し、副作用を持たない関数。テスト容易性が高い |
