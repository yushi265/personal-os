# Obsidian Personal OS Plugin 詳細設計書 v1.0

- 版数: v1.0
- 作成日: 2026-07-04
- 対応文書: 要件定義書 v2.0 / 基本設計書 v1.0
- 対象範囲: MVP(Phase 1〜7)

本書は基本設計書の各モジュールを実装可能なレベルまで詳細化する。コードは実装の骨格を示すものであり、実装時の軽微な調整を妨げない。

---

## 1. 共通定義

### 1.1 定数・型定義(src/domain/entity.ts)

```typescript
export const ENTITY_TYPES = ["goal", "project", "ticket", "review", "resource", "inbox"] as const;
export type EntityType = typeof ENTITY_TYPES[number];

export const GOAL_STATUSES    = ["active", "paused", "done", "archived"] as const;
export const PROJECT_STATUSES = ["backlog", "active", "waiting", "review", "done", "archived"] as const;
export const TICKET_STATUSES  = ["backlog", "ready", "doing", "waiting", "review", "done", "archived"] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = typeof PRIORITIES[number];

export const REVIEW_CYCLES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export type ReviewCycle = typeof REVIEW_CYCLES[number];

/** 未完了statusの定義(judge.tsで使用) */
export const OPEN_STATUSES: Record<"project" | "ticket" | "goal", ReadonlySet<string>> = {
  goal:    new Set(["active", "paused"]),
  project: new Set(["backlog", "active", "waiting", "review"]),
  ticket:  new Set(["backlog", "ready", "doing", "waiting", "review"]),
};
```

### 1.2 frontmatterキー ⇔ 内部モデル対応表

| frontmatterキー | Entityプロパティ | 型変換 |
|---|---|---|
| `type` | `type` | 文字列。ENTITY_TYPES外は解析エラー扱い |
| `status` | `status` | 文字列。type別の許容値外は解析エラー扱い |
| `goal` / `project` | `goal` / `project` | wikilink文字列 → `getFirstLinkpathDest()` でパス解決。解決不能時は原文保持+警告 |
| `priority` | `priority` | PRIORITIES外は `undefined` |
| `progress` | `progress` | number化。0-100へclamp |
| `start` / `due` / `last_reviewed` / `archived_at` | `start` / `due` / `lastReviewed` / `archivedAt` | `YYYY-MM-DD` 検証。不正時は `undefined`+警告 |
| `review_cycle` | `reviewCycle` | REVIEW_CYCLES外は `undefined` |
| `tags` / `labels` / `blockers` | 同名 | 配列化(単一文字列は1要素配列へ) |
| 上記以外 | `extra` | そのまま保持(改変禁止) |

### 1.3 日付ユーティリティ(src/domain/date.ts)

```typescript
/** 端末ローカル日付を YYYY-MM-DD で返す(TZ問題回避のためDate→ISOは使わない) */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** review_cycle を加算した日付を返す */
export function addCycle(date: string, cycle: ReviewCycle): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  switch (cycle) {
    case "daily":     base.setDate(base.getDate() + 1); break;
    case "weekly":    base.setDate(base.getDate() + 7); break;
    case "monthly":   base.setMonth(base.getMonth() + 1); break;
    case "quarterly": base.setMonth(base.getMonth() + 3); break;
    case "yearly":    base.setFullYear(base.getFullYear() + 1); break;
  }
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}
```

- 月末補正はJavaScript `Date` の自動繰り上げに委ねる(1/31 + 1month = 3/2 相当となるが、レビュー判定用途では許容とする)

### 1.4 イベントバス(src/infra/EventBus.ts)

View再描画の通知に使用。Obsidianの `Events` クラスを継承する。

```typescript
export type POSEvent =
  | "index-updated"        // IndexStore変更(payload: 変更パス[])
  | "settings-updated"
  | "capability-changed";  // 依存プラグイン状態変化

export class POSEventBus extends Events {
  emitEvent(name: POSEvent, payload?: unknown): void { this.trigger(name, payload); }
  onEvent(name: POSEvent, cb: (payload?: unknown) => void): EventRef { return this.on(name, cb); }
}
```

---

## 2. Infrastructure層 詳細

### 2.1 VaultRepository(src/infra/VaultRepository.ts)

全ファイルI/Oの唯一の窓口。Services層はObsidian APIを直接触らない。

```typescript
export class VaultRepository {
  constructor(private app: App, private settings: POSSettings) {}

  // ---- 参照 ----
  isUnderRoot(path: string): boolean;                 // rootDirectory配下か
  getEntityFolder(type: EntityType): string;          // type→フォルダパス解決
  getFile(path: string): TFile | null;
  async readBody(path: string): Promise<string>;      // cachedRead使用

  // ---- 作成 ----
  /** テンプレート適用済み本文でノート作成。同名時は " 1" サフィックスで回避 */
  async createEntityNote(type: EntityType, title: string, body: string): Promise<TFile>;

  // ---- 更新 ----
  /** frontmatter更新。fn内でfmを直接書き換える */
  async updateFrontmatter(path: string, fn: (fm: Record<string, unknown>) => void): Promise<void>;
  /** 本文のアトミック編集(vault.process) */
  async processBody(path: string, fn: (body: string) => string): Promise<void>;
  /** 指定行の置換/削除。行番号ズレ検出のため期待行内容を照合 */
  async editLine(path: string, line: number, expected: string, next: string | null): Promise<EditLineResult>;

  // ---- 移動/削除 ----
  async moveToArchive(path: string): Promise<void>;   // fileManager.renameFile
  async trash(path: string): Promise<void>;           // vault.trash(システムゴミ箱)
}

export type EditLineResult = "ok" | "line-mismatch" | "not-found";
```

editLine の照合仕様(重要):

- Todo編集はインデックス上の行番号を頼るが、ユーザー編集で行がズレる可能性がある
- `expected`(インデックス保持時の行内容)と実際の行を比較し、不一致なら:
  1. 本文全体から `expected` と完全一致する行を再検索(1件のみ一致なら採用)
  2. 見つからない/複数一致 → `"line-mismatch"` を返し、呼び出し側は `Notice("ノートが更新されています。再読み込みしてください")` +インデックス再構築

### 2.2 IndexStore(src/infra/IndexStore.ts)

```typescript
export class IndexStore {
  private entities = new Map<string, Entity>();
  private todos = new Map<string, Todo[]>();            // key: 親ノートpath
  private byType = new Map<EntityType, Set<string>>();
  private childrenOf = new Map<string, Set<string>>();  // 親path → 子pathの集合
  private parseErrors = new Map<string, string>();      // path → エラー理由

  // ---- 更新系 ----
  upsertEntity(e: Entity): void;
  setTodos(parentPath: string, todos: Todo[]): void;
  remove(path: string): void;
  handleRename(oldPath: string, e: Entity, todos: Todo[]): void;
  addParseError(path: string, reason: string): void;

  // ---- 参照系 ----
  get(path: string): Entity | undefined;
  listByType(type: EntityType): Entity[];               // title昇順
  getChildren(parentPath: string): Entity[];            // childrenOfから解決
  getTodos(parentPath: string): Todo[];
  getAllTodos(): Todo[];
  getParseErrors(): { path: string; reason: string }[];
  stats(): { entities: number; todos: number; errors: number };
}
```

childrenOf の構築規則:

- Entity登録時、`e.goal` があれば `childrenOf[goalPath] += e.path`、`e.project` があれば `childrenOf[projectPath] += e.path`
- 削除・rename時は逆引きで除去(逆引き用に `parentKeysOf: Map<path, string[]>` を内部保持)

### 2.3 Indexer(src/infra/Indexer.ts)

インデックス構築のオーケストレータ。

起動時フルスキャンのシーケンス:

```
onLayoutReady
  │
  ▼
vault.getMarkdownFiles() → isUnderRoot でフィルタ
  │
  ▼
各ファイル: metadataCache.getFileCache(file)?.frontmatter を取得
  │           (キャッシュのみ。本文読み込みなし)
  ▼
frontmatter → Entity 変換(parseEntity)
  │  変換失敗 → parseErrors へ登録
  ▼
type ∈ {ticket, project, inbox} のノートのみ:
  DataviewAdapter.getTodos(path) でTodo取得
  │
  ▼
IndexStore へ一括登録 → ProgressService.recalcAll()
  │
  ▼
eventBus.emitEvent("index-updated")
```

差分更新(metadataCache "changed"):

```typescript
async reindexFile(file: TFile): Promise<void> {
  if (this.selfWriteGuard.isSuppressed(file.path)) return;  // §2.4
  const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
  const result = parseEntity(file, fm);
  if (result.ok) {
    this.store.upsertEntity(result.entity);
    if (hasTodos(result.entity.type)) {
      this.store.setTodos(file.path, await this.dvAdapter.getTodos(file.path));
    }
  } else {
    this.store.addParseError(file.path, result.reason);
  }
  await this.progressService.recalcAncestors(file.path);
  this.eventBus.emitEvent("index-updated", [file.path]);
}
```

### 2.4 SelfWriteGuard(自己書き込み抑制)

progress書き戻し等による無限ループ防止(基本設計 §4.1)。

```typescript
export class SelfWriteGuard {
  private suppressed = new Map<string, number>();  // path → 期限(epoch ms)
  private static readonly TTL_MS = 500;

  markWrite(path: string): void { this.suppressed.set(path, Date.now() + SelfWriteGuard.TTL_MS); }
  isSuppressed(path: string): boolean {
    const until = this.suppressed.get(path);
    if (until === undefined) return false;
    if (Date.now() > until) { this.suppressed.delete(path); return false; }
    return true;
  }
}
```

- VaultRepositoryの全書き込みメソッドが書き込み直前に `markWrite()` を呼ぶ
- 抑制中でもエディタ上の表示はObsidianが更新するため、UX影響なし

### 2.5 DataviewAdapter(src/infra/DataviewAdapter.ts)

```typescript
export class DataviewAdapter {
  get available(): boolean { return !!this.app.plugins.plugins["dataview"]; }
  private get api(): DataviewApi | null { return getAPI(this.app) ?? null; }

  /** 1ノート内の全タスクをTodoへ変換 */
  async getTodos(path: string): Promise<Todo[]> {
    const page = this.api?.page(path);
    if (!page?.file?.tasks) return [];
    return page.file.tasks.values.map((t: STask) => this.toTodo(t, path));
  }

  private toTodo(t: STask, filePath: string): Todo {
    return {
      filePath,
      line: t.line,
      text: stripMetadata(t.text),          // 📅/🛫/✅/[key::] を除去した表示用本文
      done: t.completed,
      dueDate: extractEmojiDate(t.text, "📅"),
      startDate: extractEmojiDate(t.text, "🛫"),
      doneDate: extractEmojiDate(t.text, "✅"),
      priority: normalizePriority(t.priority ?? extractInline(t.text, "priority")),
      labels: extractInlineList(t.text, "labels"),
      parentType: this.resolveParentType(filePath),
      parentPath: filePath,
    };
  }
}
```

メタデータ抽出の正規表現仕様:

| 対象 | パターン |
|---|---|
| 絵文字日付 | `/(📅\|🛫\|✅)\s*(\d{4}-\d{2}-\d{2})/gu` |
| インラインフィールド | `/\[(priority\|labels)::\s*([^\]]+)\]/g` |
| labels複数値 | `,` 区切り → trim → 空要素除去 |

- Dataviewのインデックス完了前アクセスに備え、`dataview:index-ready` イベントを待ってから初回フルスキャンを行う

### 2.6 TasksAdapter(src/infra/TasksAdapter.ts)

- 役割: Tasksプラグインの**存在チェックのみ**(記法の解釈はDataview経由で完結するため)
- Todo完了操作は自前実装とし、行末に ` ✅ ${today()}` を付与する(Tasksプラグインのトグルと同等の出力になることをテストで担保)

```typescript
export function toggleTodoLine(line: string, doneDate: string): string {
  if (/^\s*- \[ \]/.test(line)) {
    return line.replace("- [ ]", "- [x]") + ` ✅ ${doneDate}`;
  }
  // 完了→未完了: ✅日付を除去
  return line.replace("- [x]", "- [ ]").replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "");
}
```

---

## 3. Domain層 詳細

### 3.1 parseEntity(src/domain/entity.ts)

```typescript
export type ParseResult =
  | { ok: true; entity: Entity; warnings: string[] }
  | { ok: false; reason: string };

export function parseEntity(
  file: { path: string; basename: string },
  fm: Record<string, unknown> | undefined,
  resolveLink: (link: string) => string | null
): ParseResult {
  if (!fm?.type) return { ok: false, reason: "type未定義" };
  if (!ENTITY_TYPES.includes(fm.type as EntityType))
    return { ok: false, reason: `不正なtype: ${fm.type}` };
  const type = fm.type as EntityType;

  const status = String(fm.status ?? defaultStatusOf(type));
  if (!validStatusesOf(type).includes(status))
    return { ok: false, reason: `不正なstatus: ${status}` };

  const warnings: string[] = [];
  // ...各プロパティを §1.2 の規則で変換。不正値は warnings に積んで undefined 化...

  return { ok: true, entity: { /* ... */ }, warnings };
}
```

- **エラー(除外)とワーニング(継続)の線引き**: `type`/`status` の不正はエラー、それ以外は警告として取り込む(壊れた1プロパティでノート全体を見失わないため)

### 3.2 judge.ts / progress.ts

基本設計 §4.1・§4.2 の定義をそのまま採用(変更なし)。追加でテスト観点を §9 に定義する。

### 3.3 query.ts(Advanced Search評価器)

```typescript
export function evaluate(q: ParsedQuery, e: Entity): boolean {
  for (const [key, cond] of Object.entries(q.filters)) {
    switch (key) {
      case "type":     if (e.type !== cond) return false; break;
      case "status":   if (e.status !== cond) return false; break;
      case "priority": if (e.priority !== cond) return false; break;
      case "tags":     if (!e.tags.includes(cond)) return false; break;
      case "labels":   if (!e.labels.includes(cond)) return false; break;
      case "goal":     if (!matchTitle(e.goal, cond)) return false; break;
      case "project":  if (!matchTitle(e.project, cond)) return false; break;
      case "due":      if (!matchDue(e.due, cond)) return false; break;  // <YYYY-MM-DD / >… / 完全一致
    }
  }
  if (q.text && !e.title.toLowerCase().includes(q.text.toLowerCase())) return false;
  return true;
}
```

- Todoに対する評価も同型の `evaluateTodo()` を用意(対象キー: priority / labels / due / text)
- 本文全文検索は `prepareSimpleSearch(q.text)` を用い、対象ノートを絞った上で `cachedRead` する(全ノートの本文常時保持はしない)

---

## 4. Application層(Services)詳細

### 4.1 EntityService

```typescript
export class EntityService {
  /** 作成: テンプレート解決→ノート生成→ログ→インデックス反映 */
  async create(input: CreateEntityInput): Promise<TFile>;
  /** status変更(Kanban D&D・メニューから) */
  async changeStatus(path: string, next: string): Promise<void>;
  /** アーカイブ */
  async archive(path: string): Promise<void>;
  /** 削除(vault.trash) */
  async delete(path: string): Promise<void>;
}

interface CreateEntityInput {
  type: EntityType;
  title: string;
  goal?: string;         // Goalノートのpath
  project?: string;
  priority?: Priority;
  due?: string;
  templateName?: string; // Templates/内のファイル名
}
```

create の処理詳細:

```
① タイトル検証: ファイル名禁止文字 [\\/:*?"<>|#^[]] を "-" に置換
② テンプレート読込(templateName指定時)。
   プレースホルダ置換: {{title}} {{date}} {{goal}} {{project}}
③ frontmatter組み立て(§1.2の逆変換。goal/projectはwikilink化 "[[Title]]")
④ VaultRepository.createEntityNote()
⑤ ActivityLogService.log("create", ...)
⑥ 生成したTFileを返す(呼び出し元Modalがノートを開く)
```

changeStatus のバリデーション:

- `next` が type別許容値に含まれない場合は例外(UIバグの早期検出)
- `done` への変更時: type=ticket なら親Projectのprogress再計算をトリガ
- ActivityLogに `[status] {title}: {old} → {new}` を記録

archive の処理順(基本設計 §6.2 準拠、失敗時継続性を考慮):

```
① updateFrontmatter: status=archived, archived_at=today()
② moveToArchive()   ← ①成功後に実行。②失敗時はNotice+①は維持(再実行で回復可能)
③ ActivityLog記録
```

### 4.2 TodoService

```typescript
export class TodoService {
  /** QuickAdd: 保存先ノート末尾へTodo行を追記 */
  async quickAdd(input: QuickAddInput): Promise<void>;
  /** 完了トグル */
  async toggle(todo: Todo): Promise<void>;
  /** 削除 */
  async remove(todo: Todo): Promise<void>;
  /** フィルタ済み一覧(Dashboard/Todo管理画面用) */
  list(filter: TodoFilter): Todo[];
}

interface QuickAddInput {
  text: string;
  target: "inbox" | string;   // "inbox" or ノートpath
  dueDate?: string;
  priority?: Priority;
}
```

quickAdd の行生成:

```typescript
function buildTodoLine(i: QuickAddInput): string {
  let line = `- [ ] ${i.text.trim()}`;
  if (i.dueDate) line += ` 📅 ${i.dueDate}`;
  if (i.priority) line += ` [priority:: ${i.priority}]`;
  return line;
}
```

- target="inbox" の場合、`Inbox/inbox.md` を保存先とする(存在しなければ `type: inbox` のfrontmatter付きで自動生成)
- toggle/remove は `editLine()` を使用し、`line-mismatch` 時は再インデックス+Notice(§2.1)

### 4.3 PromoteService

Todo→Ticket昇格の詳細シーケンス(基本設計 §4.3 のロールバックを具体化):

```typescript
async promoteTodoToTicket(todo: Todo, opt: PromoteOptions): Promise<void> {
  let created: TFile | null = null;
  try {
    // ① Ticketノート生成(goal/projectは opt.project の frontmatter から継承)
    created = await this.entityService.create({
      type: "ticket", title: opt.newTitle, project: opt.projectPath,
      goal: this.inheritGoal(opt.projectPath), templateName: opt.template,
    });
    // ② 元Todo本文をTicketノートへ移設(## Todo セクション配下)
    await this.repo.processBody(created.path, body =>
      body + `\n## Todo\n${rebuildTodoLine(todo)}\n`);
    // ③ 元Todo行の処理
    const result = await this.applySourceTodoAction(todo, opt.sourceAction, created);
    if (result === "line-mismatch") throw new PromoteConflictError();
    // ④ ログ
    await this.log.log("promote", `Todo「${todo.text}」→ Ticket「${opt.newTitle}」`);
  } catch (e) {
    if (created) await this.repo.trash(created.path);   // ロールバック
    new Notice(e instanceof PromoteConflictError
      ? "元ノートが更新されたため中断しました。再度実行してください。"
      : "昇格に失敗しました。");
    throw e;
  }
}
```

sourceAction 別処理(③):

| 選択 | editLine の next |
|---|---|
| 削除 | `null`(行削除) |
| 完了 | `toggleTodoLine(line, today())` |
| リンク化 | `- [ ] [[${newTitle}]]`(メタデータは新Ticket側へ移設済みのため除去) |

Ticket→Project昇格:

```
① Projectノート生成(goal継承、status=backlog)
② 元Ticketのfrontmatter変換: type=project / status=backlog / project削除
   ではなく → 元Ticketノート自体を Projects/ へ移動+frontmatter書換
③ 配下Todoはノートごと移動するため追加処理不要
④ ログ記録
```

- ②で「新規作成+コピー」ではなく「移動+書換」を採用する理由: 既存のwikilink(他ノートからの `[[チケット名]]` 参照)を `renameFile` のリンク自動更新で維持できるため

### 4.4 ReviewService

```typescript
async submitReview(input: ReviewInput): Promise<void> {
  // ① Reviews/ へレビューノート生成
  //    ファイル名: {対象title}-{YYYY-MM-DD}.md(同日重複時は -2 サフィックス)
  // ② 対象Entityの last_reviewed = today() に更新
  // ③ decision に応じた status 更新:
  //      continue → 変更なし / pause → waiting(goal: paused) / complete → done
  // ④ ActivityLog記録
}
```

レビューノートのテンプレート:

```markdown
---
type: review
target: "[[住宅購入]]"
cycle: weekly
reviewed_at: 2026-07-04
decision: continue
---

## Progress
(記入内容)

## Blocker
(記入内容)

## Next Action
(記入内容)
```

### 4.5 ExportService

AI Export生成アルゴリズム:

```
① IndexStoreから type=goal(status: active/paused)を取得
② Goal毎に childrenOf でProject → Ticket → Todoを深さ優先で展開
③ 孤児Entity(親リンク切れ)は末尾の「## Unlinked」セクションへ
④ Overdue / Review Needed / Blockers セクションを judge.ts で抽出
⑤ 文字列連結 → navigator.clipboard.writeText()
⑥ Notice("AIコンテキストをコピーしました(N文字)")
```

AI Summary の出力仕様:

```markdown
# Personal OS Summary (2026-07-04)
- Active Projects: 3 / Tickets(doing): 5 / 未完了Todo: 24
- ⚠ Overdue: 2件(比較表を作る 📅2026-07-01, ...)
- 🔍 Review Needed: 1件(住宅購入: weekly, last 2026-06-20)
- ⛔ Blocked: 1件(引っ越し準備)
```

### 4.6 ActivityLogService

```typescript
async log(kind: LogKind, message: string): Promise<void> {
  const path = `${root}/${logs}/${yyyyMM()}.md`;   // 月次ローテーション
  const line = `- ${today()} ${hhmm()} [${kind}] ${message}\n`;
  await this.repo.appendOrCreate(path, line, "---\ntype: resource\n---\n# Activity Log\n");
}
export type LogKind = "create" | "update" | "status" | "review" | "archive" | "promote";
```

- ログノートは `type: resource` とし、Entityインデックスの対象外にはしない(Recent Updatesのノイズになるため、**Recent UpdatesではLogs/配下を除外する**)

### 4.7 SavedViewService

```typescript
interface SavedView {
  id: string;            // crypto.randomUUID()
  name: string;          // "今週" "仕事" 等
  query: string;         // Advanced Searchクエリ文字列(パース前の原文を保存)
  sort: { key: "due" | "priority" | "title" | "progress"; order: "asc" | "desc" };
  viewMode: "list" | "kanban";
}
```

- 保存先: `data.json`(settings内 `savedViews: SavedView[]`)
- クエリは原文保存とし、表示時に毎回パースする(スキーマ進化に強い)

---

## 5. UI詳細設計

### 5.1 Svelteコンポーネント構成

```
ui/
├── dashboard/
│   ├── DashboardView.ts          # ItemView。Svelteをmount
│   ├── Dashboard.svelte          # Widgetグリッド(CSS Grid, 2列/モバイル1列)
│   └── widgets/
│       ├── TodayTodoWidget.svelte
│       ├── OverdueWidget.svelte
│       ├── ActiveEntitiesWidget.svelte   # Goals/Projects/Tickets共用(prop: type)
│       ├── ReviewNeededWidget.svelte
│       ├── BlockedWidget.svelte
│       ├── RecentUpdatesWidget.svelte
│       ├── ActivityLogWidget.svelte
│       └── ParseErrorWidget.svelte       # エラー可視化(基本設計 §8.2)
├── kanban/
│   ├── KanbanView.ts
│   ├── Kanban.svelte             # 列レンダリング+D&D制御
│   ├── KanbanColumn.svelte
│   └── KanbanCard.svelte         # title/priority/due/progress/blockerバッジ
├── preview/
│   ├── PreviewView.ts
│   └── Preview.svelte            # Entity詳細(セクション折りたたみ式)
└── modals/
    ├── CreateEntityModal.ts      # Obsidian Modal + フォーム
    ├── QuickAddModal.ts
    ├── PromoteModal.ts
    └── ReviewModal.ts
```

### 5.2 View共通ライフサイクル

```typescript
export class DashboardView extends ItemView {
  getViewType() { return "pos-dashboard"; }
  getDisplayText() { return "Personal OS Dashboard"; }
  getIcon() { return "layout-dashboard"; }

  async onOpen() {
    this.component = mount(Dashboard, {
      target: this.contentEl,
      props: { plugin: this.plugin },
    });
    this.registerEvent(  // index-updated購読 → Svelte側storeを更新
      this.plugin.eventBus.onEvent("index-updated", () => this.refresh())
    );
  }
  async onClose() { unmount(this.component); }
}
```

- 再描画はSvelteのリアクティビティに委ね、View側は `refresh()` でstore(`writable<DashboardData>`)を差し替えるのみ
- `index-updated` の連続発火対策として、refresh呼び出しを100msデバウンス(短時間の連続呼び出しを1回にまとめる)する

### 5.3 Kanban D&D仕様

| 項目 | 仕様 |
|---|---|
| 実装 | HTML5 Drag and Drop(`dragstart`/`dragover`/`drop`) |
| dropアクション | `EntityService.changeStatus(path, 列のstatus値)` |
| 楽観的更新 | UIは即時移動 → changeStatus失敗時は元列へ戻す+Notice |
| モバイル代替 | カードタップ → `Menu` でstatus選択(Platform.isMobileで分岐) |
| 列内ソート | priority(high→low)→ due昇順 → title。手動並び替えはMVP対象外 |

### 5.4 QuickAddModal入力仕様

| フィールド | UI | バリデーション |
|---|---|---|
| 本文 | text input(autofocus) | 必須。空はSubmit不可 |
| 保存先 | サジェスト(Inbox / Ticket / Projectノート) | デフォルト: Inbox |
| 📅期限 | date input | 任意 |
| priority | セグメントボタン(high/medium/low) | デフォルト: settings.defaultPriority |

- Enterで即Submit(モバイル配慮)。Submit後にModalを閉じ `Notice("追加しました")`

### 5.5 SettingsTab構成

| セクション | 項目 |
|---|---|
| フォルダ | Root Directory / 各フォルダ名(§7設定スキーマ準拠。変更時は既存フォルダのrenameは行わず、参照先のみ変更+注意文言表示) |
| Dashboard | Widget表示トグル+ドラッグ並び替えリスト / Recent Updates件数 |
| デフォルト値 | Review Cycle / Priority |
| Kanban | 列表示名(status値は変更不可の旨を注記) |
| 依存プラグイン | Tasks/Dataviewの検出状態表示+導入リンク |

---

## 6. main.ts ライフサイクル詳細

```typescript
export default class PersonalOSPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.eventBus = new POSEventBus();
    this.repo = new VaultRepository(this.app, this.settings);
    this.store = new IndexStore();
    // Adapter → Service の順で初期化(依存注入)
    this.registerViews();       // registerView × 4
    this.registerCommands();    // §6.1
    this.addSettingTab(new POSSettingsTab(this.app, this));
    this.addRibbonIcon("layout-dashboard", "Open Personal OS Dashboard", () => this.openDashboard());

    this.app.workspace.onLayoutReady(async () => {
      this.detectCapability();          // Tasks/Dataviewチェック
      await this.waitDataviewReady();   // dataview:index-ready or 即時
      await this.indexer.fullScan();
      this.registerVaultEvents();       // changed/rename/delete(フルスキャン後に登録)
    });
  }

  onunload() { /* Viewはdetachせず放置(Obsidian推奨)。イベントはregisterEventで自動解除 */ }
}
```

### 6.1 コマンド登録一覧

| コマンドID | 名称 | checkCallback条件 |
|---|---|---|
| `create-goal` 他4種 | Create Goal/Project/Ticket/Todo | Todo系はcapability.todoFeatures |
| `open-dashboard` | Open Dashboard | — |
| `open-review` | Open Review | アクティブノートがproject/goal |
| `promote-todo` | Promote Todo to Ticket | カーソル行がTodo+capability |
| `promote-ticket` | Promote Ticket to Project | アクティブノートがticket |
| `archive-entity` | Archive Entity | アクティブノートがEntity |
| `export-ai-context` | Export AI Context | — |
| `refresh-index` | Refresh Index | — |

---

## 7. エラーコード・通知文言一覧

| コード | 場面 | Notice文言 |
|---|---|---|
| E001 | 依存プラグイン未検出 | Tasks / Dataview プラグインが必要です。Todo機能は無効化されています。 |
| E002 | frontmatter解析エラー | (Noticeなし。ParseErrorWidgetに集約表示) |
| E003 | editLine不一致 | ノートが更新されています。再読み込みしました。 |
| E004 | 昇格ロールバック | 元ノートが更新されたため中断しました。再度実行してください。 |
| E005 | Archive移動失敗 | アーカイブフォルダへの移動に失敗しました(status変更は完了)。 |
| E006 | クリップボード失敗 | コピーに失敗しました。 |

- 文言は `i18n/ja.ts` に集約(`t("E001")` 形式)

---

## 8. パフォーマンス設計詳細

| 対策 | 内容 |
|---|---|
| 起動 | frontmatterはMetadataCacheのみ参照。Todoパース対象ノート(ticket/project/inbox)のみDataview API呼び出し |
| 差分更新 | 1ファイル単位再解析+**祖先のみ**progress再計算(全体再計算しない) |
| 再描画 | index-updated → 100msデバウンス → 表示中Viewのみstore更新 |
| メモリ | 本文テキストはインデックスに保持しない(タイトル+frontmatter+Todo行のみ) |
| 全文検索 | クエリ実行時のみ対象を絞って `cachedRead` |

---

## 9. テストケース定義(抜粋)

### 9.1 progress.ts

| # | 入力 | 期待値 |
|---|---|---|
| P-1 | Todo 0件 | 0 |
| P-2 | 3件中1件完了 | 33(四捨五入) |
| P-3 | 3件中2件完了 | 67 |
| P-4 | Project: Ticket[100, 0] + 直下Todoなし | 50 |
| P-5 | Project: Ticket[100] + 直下Todo 2件中1件完了 | 75(=avg(100, 50)) |
| P-6 | Project: Ticket 0件 + 直下Todo 0件 | 0 |

### 9.2 judge.ts

| # | 条件 | 期待 |
|---|---|---|
| J-1 | due=昨日, status=doing | Overdue: true |
| J-2 | due=昨日, status=done | Overdue: false |
| J-3 | due=本日 | Overdue: false(当日は含まない) |
| J-4 | lastReviewed=なし, cycle=weekly | ReviewNeeded: true |
| J-5 | lastReviewed=8日前, cycle=weekly | ReviewNeeded: true |
| J-6 | lastReviewed=6日前, cycle=weekly | ReviewNeeded: false |
| J-7 | blockers=1件, status=archived | Blocked: false |
| J-8 | 月末: lastReviewed=1/31, cycle=monthly, today=3/02 | ReviewNeeded: true(繰り上げ仕様) |

### 9.3 query.ts

| # | クエリ | 期待 |
|---|---|---|
| Q-1 | `type:ticket status:doing` | 両条件AND一致のみtrue |
| Q-2 | `due:<2026-07-10` | due=2026-07-09でtrue、07-10でfalse |
| Q-3 | `priority:high 銀行` | フィルタ+タイトル部分一致AND |
| Q-4 | 空文字クエリ | 全件true |

### 9.4 toggleTodoLine

| # | 入力行 | 期待 |
|---|---|---|
| T-1 | `- [ ] test 📅 2026-07-10` | `- [x] test 📅 2026-07-10 ✅ {today}` |
| T-2 | `- [x] test ✅ 2026-07-01` | `- [ ] test` |
| T-3 | インデント付き `  - [ ] sub` | インデント維持で完了化 |

---

## 10. 実装チェックリスト(Phase対応)

- [ ] Phase 1: settings / VaultRepository / IndexStore / Indexer / parseEntity / EntityService(CRUD) / SelfWriteGuard
- [ ] Phase 2: DataviewAdapter / TasksAdapter / TodoService / QuickAddModal / toggleTodoLine
- [ ] Phase 3: judge.ts / DashboardView + 全Widget / PreviewView / ProgressService
- [ ] Phase 4: KanbanView(D&D+モバイル代替) / PromoteService / archive / ActivityLogService
- [ ] Phase 5: ReviewService + ReviewModal / SavedViewService / query.ts + 検索UI / TimelineView
- [ ] Phase 6: ExportService(AI Export / AI Summary)
- [ ] Phase 7: capability制御 / ParseErrorWidget / i18nリソース化 / モバイル実機確認 / 受け入れ基準チェック
