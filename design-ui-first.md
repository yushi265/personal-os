# Obsidian Personal OS Plugin UIファースト操作 設計書 v1.0

- 版数: v1.0
- 作成日: 2026-07-04
- 対応要件: 要件定義書 v2.0(requirements.md)/ UIファースト操作 要件定義書 v1.0(requirements-ui-first.md)
- 対応既存設計: 基本設計書 v1.0(design.md)/ 詳細設計書 v1.0(detail-design.md)
- 位置づけ: MVP(Phase 1〜7)完了後の第1次機能追加。本書は design.md / detail-design.md への**追補**であり、既存章立てを変更しない

本書は基本設計書・詳細設計書と同じ流儀(方針→アーキテクチャ影響→モジュール詳細→テスト→フェーズ計画)で、UIファースト操作要件(requirements-ui-first.md)の設計を記述する。コードは実装の骨格を示すものであり、実装時の軽微な調整を妨げない。

---

## 1. 設計方針

### 1.1 基本原則の設計への落とし込み

| 要件§1.2の原則 | 設計への反映 |
|---|---|
| Markdown First は不変 | 新規UIはすべて既存の書き込みAPI(`processFrontMatter` / `vault.process` / `renameFile`)を通じてのみMarkdownへ反映する。UI層・新設Service層に独自の永続化状態(UI側だけのキャッシュ確定値等)を持たせない |
| UIとエディタの等価性 | 新設する `updateTodoLine()`(domain/todo.ts)・`EntityFieldService`(services/)はいずれも「Markdown上でユーザーが手で書ける形」と同一のテキストを生成する。UI経由でしか到達できない内部フラグ(例: UI専用のstatus値)は導入しない |
| 既存Serviceの再利用 | `EntityService.changeStatus/archive/delete`、`TodoService.toggle/remove`、`PromoteService`、`ReviewService`、`SavedViewService`をそのまま呼び出す。新設するのは「フィールド単位の書き込み」という既存Serviceに無かった**粒度**の操作のみ(§2.2参照) |

### 1.2 新規に書くもの・再利用するものの区分け

| 区分 | 対象 | 理由 |
|---|---|---|
| **再利用(変更なし)** | `EntityService.changeStatus/archive/delete`、`TodoService.toggle/remove`、`PromoteService`、`ReviewService.submitReview`、`SavedViewService`、`SearchService`、`VaultRepository`(既存メソッド群)、`IndexStore`、`domain/judge.ts`・`domain/progress.ts`・`domain/query.ts`(拡張は§1.3参照)、`CreateEntityModal`・`QuickAddModal`・`PromoteModal`・`ReviewModal` | 既存Serviceのメソッド粒度がそのままUI操作に対応するため |
| **新規(Domain層)** | `domain/todo.ts` に `updateTodoLine()`・`appendTodoToSection()` を追加 | Todoのインライン編集・その場追加は既存関数(`buildTodoLine`/`toggleTodoLine`/`rebuildTodoLine`)ではカバーできない書式操作のため。純粋関数として追加しテスト容易性を保つ |
| **新規(Infrastructure層)** | `VaultRepository.renameNote()` を追加 | Title列インライン編集・Preview詳細のTitleインライン編集(同一フォルダ内rename)は既存の`moveToArchive`/`moveToFolder`(フォルダ跨ぎ専用)ではカバーできないため |
| **新規(Application層)** | `services/EntityFieldService.ts` を新設 | §2.2で判断根拠を詳述。ManageViewのインラインセル編集とPreview詳細編集の両方から**同じフィールド更新ロジック**(バリデーション+書き込み+ActivityLog)を呼ぶための集約点 |
| **新規(Presentation層)** | `ui/manage/`(ManageView.ts / Manage.svelte / 各Column・Cellコンポーネント)、Preview.svelte の全面改修(閲覧→編集UI) | §3・§4で詳細化 |
| **拡張(既存ファイルの変更)** | `domain/query.ts`(period拡張、§1.3)、`settings/settings.ts`(SavedView型拡張、§3.4)、`src/i18n/ja.ts`(新規キー)、`src/main.ts`(View登録・コマンド追加) | 既存機能への後方互換を維持した拡張 |

### 1.3 domain/query.ts の拡張(期間フィルタとの整合)

要件§2.3の期間フィルタ(今日/今週/Overdue/期限なし)をSavedViewのクエリ文字列として永続化するため、`parseQuery`/`evaluate`/`evaluateTodo` に `period` フィルタキーを追加する。

```typescript
// domain/query.ts (拡張)
const FILTER_KEY_PATTERN = /^(type|status|priority|tags|labels|due|goal|project|period):(.+)$/;
//                                                                        ^^^^^^ 追加

export type Period = "today" | "week" | "overdue" | "none";

/** Entity向け: today基準でperiod条件を判定する(isOverdueはjudge.tsのopen-status付き定義と同一にする) */
function matchPeriod(e: Entity, period: string, today: string): boolean {
  switch (period as Period) {
    case "today":   return e.due === today;
    case "week":    return !!e.due && e.due >= today && e.due <= addDays(today, 7);
    case "overdue": return isOverdue(e, today); // judge.tsを再利用(状態はopenのみ対象)
    case "none":    return !e.due;
    default:        return true;
  }
}
```

- `evaluate(q, e, resolveTitle, today = todayDefault())` のように第4引数(省略可・デフォルトは`domain/date.today()`)を追加する。既存呼び出し元(SearchService等)は引数を渡さなくてもそのまま動作し**後方互換**を保つ
- `evaluateTodo` にも同様に `period` を追加(`isTodoOverdue`/`todo.dueDate`ベース)。Todo向けの`today`判定はエンティティのstatusを見ないため`isTodoOverdue`をそのまま使う
- `addDays(date, n)` は `domain/date.ts` に汎用ヘルパーとして追加する(既存の `addCycle` は `ReviewCycle` 単位のみのため日数加算には使えない)
- 循環インポート回避: `query.ts` が `judge.ts` を import するが、`judge.ts` は `query.ts` に依存しないため問題なし

---

## 2. アーキテクチャへの影響

### 2.1 レイヤ構成は不変

design.md §2.1 の4層構成(Presentation → Application → Domain → Infrastructure)はそのまま維持する。新規モジュールは以下のように既存レイヤへ追加配置する。

```
src/
├── domain/
│   ├── todo.ts             # updateTodoLine() / appendTodoToSection() 追加
│   ├── query.ts            # period フィルタ拡張
│   └── date.ts             # addDays() 追加
├── services/
│   └── EntityFieldService.ts   # 新設
├── infra/
│   └── VaultRepository.ts  # renameNote() 追加
└── ui/
    ├── manage/              # 新設(統合管理View)
    │   ├── ManageView.ts
    │   ├── Manage.svelte
    │   ├── ManageFilterBar.svelte
    │   ├── ManageTable.svelte
    │   ├── ManageRow.svelte
    │   └── manageData.ts
    ├── components/          # 新設(Manage/Previewで共用するセルエディタ)
    │   ├── StatusCell.svelte
    │   ├── PriorityCell.svelte
    │   ├── DateCell.svelte
    │   ├── ParentCell.svelte      # goal/project選択(サジェスト付き)
    │   ├── TitleCell.svelte       # インライン rename
    │   ├── TagChips.svelte        # tags/labels共用チップUI
    │   └── RowMenu.svelte         # 昇格/Archive/削除の「⋮」メニュー
    └── preview/
        └── Preview.svelte  # 全面改修(閲覧→編集)。PreviewView.tsは構造上不変
```

設計理由: Kanban(D&D楽観的更新)・Dashboard(デバウンス再描画)・Search(SavedView連携)の3画面ですでに確立されたパターンをManageViewが踏襲するため、`ui/manage/` は`ui/kanban/`・`ui/search/`と同じ「View.ts(ItemViewラッパ)+ *Data.ts(純粋な整形関数)+ Svelteツリー」の構成にする。

### 2.2 EntityFieldService新設の判断(設計上の最重要判断)

**判断: 新設する。**

根拠:

1. **重複箇所の実態**: status/priority/due/goal/project/title の変更は、(a) ManageViewの一覧インラインセル、(b) Preview詳細パネルのプロパティ編集、の**2箇所から同一の書き込み**が発生する。tags/labels/blockersも同様に配列フィールドとして両箇所から編集される
2. **既存Serviceは目的別**であり、汎用フィールド更新に対応しない: `EntityService.changeStatus()`はstatus専用(バリデーション込み)、`archive()`/`delete()`は状態遷移専用。priority/due/goal/project/tags/labels/blockersの汎用更新メソッドは存在しない。これを`EntityService`に追加する選択肢もあるが、「エンティティのライフサイクル操作(作成・状態遷移・削除)」と「プロパティの直接編集」は責務が異なるため、既存`EntityService`を肥大化させず新設Serviceに分離する
3. **バリデーション集約**: type別status許容値(`validStatusesOf`)と同様に、priority許容値(`PRIORITIES`)・日付形式(`YYYY-MM-DD`)・goal/projectの参照整合性(親候補の存在チェック)を1箇所に集約したい。UIコンポーネント側にバリデーションを分散させると、ManageViewとPreviewで判定がズレるリスクがある
4. **Titleのrename特例**: title変更だけは`processFrontMatter`ではなく`renameFile`(＝ノート実体の移動)になる。この分岐を各UIコンポーネントに書かせず、Service内に隠蔽する

```typescript
// services/EntityFieldService.ts
export type EntityFieldKey =
  | "status" | "priority" | "due" | "start" | "reviewCycle"
  | "goal" | "project" | "title" | "tags" | "labels" | "blockers";

export type EntityFieldValue = string | string[] | undefined;

export class EntityFieldService {
  constructor(
    private repo: VaultRepository,
    private store: IndexStore,
    private activityLog: ActivityLogger
  ) {}

  /** 単一フィールドの検証+書き込み+ActivityLog記録。titleのみrenameFile経由に分岐する */
  async updateField(path: string, key: EntityFieldKey, value: EntityFieldValue): Promise<void> {
    const entity = this.store.get(path);
    if (!entity) throw new Error(`Entity not found: ${path}`);

    this.validate(entity, key, value);          // §2.2.1 バリデーション表

    if (key === "title") {
      await this.renameTitle(entity, value as string);
      return;
    }

    const old = this.currentValueOf(entity, key);
    await this.repo.updateFrontmatter(path, (fm) => this.applyToFrontmatter(fm, key, value, entity));
    await this.activityLog.log("update", `${entity.title}: ${key} ${this.display(old)} → ${this.display(value)}`);
  }

  private async renameTitle(entity: Entity, newTitle: string): Promise<void> {
    const safe = newTitle.replace(FORBIDDEN_TITLE_CHARS, "-").trim();
    if (!safe) throw new Error(t("manage.field.titleRequired"));
    const newPath = await this.repo.renameNote(entity.path, safe); // §2.3
    await this.activityLog.log("update", `${entity.title} → ${safe}（rename）`);
    void newPath; // handleRenameはmain.tsのvault "rename"購読で処理されるため、ここでは待ち合わせのみ
  }

  // goal/project は wikilink化して書き込む(EntityService.createと同じ変換規則)
  // tags/labels/blockers は配列を丸ごと置換(空配列可)
  // status は validStatusesOf、priority は PRIORITIES、due/start は YYYY-MM-DD 形式で検証する
}
```

#### 2.2.1 バリデーション表

| key | 検証内容 | 不正時 |
|---|---|---|
| `status` | `validStatusesOf(entity.type)` に含まれるか(nullなら無制限) | 例外→呼び出し元でNotice |
| `priority` | `PRIORITIES` に含まれるか、または空文字(未設定に戻す) | 例外 |
| `due` / `start` | `YYYY-MM-DD` 正規表現一致、または空文字 | 例外 |
| `goal` / `project` | 指定pathが`IndexStore`に存在し、`type`がそれぞれ`"goal"`/`"project"`であること | 例外(不正な親を選ばせない。ドロップダウンの選択肢自体をIndexStore由来にすることでUI側では基本発生しない) |
| `title` | 空文字でないこと(禁止文字は`FORBIDDEN_TITLE_CHARS`で置換のうえ許可) | 例外 |
| `tags` / `labels` / `blockers` | 配列であること(要素の重複除去はUI側で実施、Service側では素通し) | — |

- 例外はすべて呼び出し元(ManageView/Preview)の`try/catch`で捕捉し、`Notice`+楽観的更新のロールバックを行う(§3.3・§4.2で詳述)

### 2.3 VaultRepository.renameNote() の追加

```typescript
// infra/VaultRepository.ts (追加)
/** 同一フォルダ内でのファイル名変更(rename)。フォルダ跨ぎのmoveToFolder/moveToArchiveとは別メソッドとする */
async renameNote(path: string, newTitle: string): Promise<string> {
  const file = this.getFile(path);
  if (!file) throw new Error(`File not found: ${path}`);

  const folder = file.parent?.path ?? "";
  let target = folder ? `${folder}/${newTitle}.${file.extension}` : `${newTitle}.${file.extension}`;
  let suffix = 1;
  while (this.app.vault.getAbstractFileByPath(target) && target !== path) {
    target = folder ? `${folder}/${newTitle} ${suffix}.${file.extension}` : `${newTitle} ${suffix}.${file.extension}`;
    suffix++;
  }
  if (target === path) return path; // 変更なし

  this.selfWriteGuard.markWrite(path);
  this.selfWriteGuard.markWrite(target);
  await this.app.fileManager.renameFile(file, target);
  return target;
}
```

- `fileManager.renameFile`のため既存ノートからの`[[旧タイトル]]`リンクは自動更新される(design.md §6.1と同じ理由)
- rename後の`IndexStore`反映は、既存の`vault.on("rename", ...)` → `Indexer.handleRename()`の購読(main.ts:387-389)にそのまま乗る。`EntityFieldService`側で`IndexStore`を直接更新する処理は書かない(二重更新・競合を避ける)

---

## 3. A. 統合管理View 詳細設計

### 3.1 コンポーネントツリー

```
ManageView.ts (ItemView, VIEW_TYPE_ID = "pos-manage")
└── Manage.svelte
    ├── ManageFilterBar.svelte     # キーワード/status/priority/goal・project/期間/tags・labels/完了済み表示
    │   └── (タブ切替ボタンもここに内包。Kanban.svelteのモード切替ボタンと同じ見た目パターン)
    └── ManageTable.svelte          # tab別に列定義を切り替える薄いラッパ
        └── ManageRow.svelte × N
            ├── TitleCell.svelte        # rename / Todoは編集不可(text表示)
            ├── StatusCell.svelte       # ドロップダウン(ui/components/共用)
            ├── ParentCell.svelte       # goal or project ドロップダウン(共用)
            ├── PriorityCell.svelte     # ドロップダウン(共用)
            ├── DateCell.svelte         # date input(共用)
            ├── (Todoタブのみ) チェックボックス + TodoTextCell
            └── RowMenu.svelte          # 「⋮」→ 昇格/Archive/削除(共用)
```

- `StatusCell`/`PriorityCell`/`DateCell`/`ParentCell`/`TitleCell`/`RowMenu`は`ui/components/`に置き、**Preview.svelteからも同じコンポーネントをimportして使う**(§4のB.詳細編集と共通化)。これにより「一覧のインラインセルと詳細パネルのフィールド編集で同じ操作が出てくる」という要件記載の重複を、UIコンポーネントレベルでも解消する
- 各セルコンポーネントは `{ value, onCommit(newValue), onCancel() }` の共通propsシグネチャを持ち、`onCommit`の中身(=`EntityFieldService.updateField`呼び出し)はView側(ManageView/Preview.svelte)が注入する。セルコンポーネント自身は「値の入力UIと確定/取消」だけを知り、書き込み先の詳細を知らない(責務分離)

### 3.2 データフロー(manageData.ts)

```typescript
// ui/manage/manageData.ts
export type ManageTab = "project" | "ticket" | "todo";

export interface ManageFilter {
  keyword: string;
  statuses: string[];       // 複数選択(空配列=全件)
  priorities: string[];
  parentPath?: string;      // goal(projectタブ) or project(ticketタブ)
  period?: "today" | "week" | "overdue" | "none";
  tags: string[];
  labels: string[];
  showDone: boolean;        // Todoタブのみ有効
  showArchived: boolean;    // Projects/Ticketsタブのみ有効
}

export interface ManageSort {
  key: "due" | "priority" | "title" | "progress"; // Todoタブは due/priority/text(→title相当)/所属
  order: "asc" | "desc";
}

export interface ManageRowData {
  kind: "entity" | "todo";
  entity?: Entity;   // kind === "entity"
  todo?: Todo;       // kind === "todo"
}

/** ManageFilter → domain/query.ts の ParsedQuery へのマッピング */
export function filterToQuery(f: ManageFilter): ParsedQuery { /* §3.2.1 */ }

/** ManageFilter ⇔ クエリ文字列(SavedView.query保存用)の相互変換 */
export function filterToQueryString(f: ManageFilter): string { /* §3.2.1 */ }
export function queryStringToFilter(s: string): ManageFilter { /* parseQuery()の逆変換+デフォルト補完 */ }

export function buildManageRows(plugin: PersonalOSPlugin, tab: ManageTab, filter: ManageFilter, sort: ManageSort): ManageRowData[] {
  const today = todayFn();
  if (tab === "todo") {
    let todos = plugin.store.getAllTodos();
    if (!filter.showDone) todos = todos.filter((t) => !t.done);
    const q = filterToQuery(filter);
    todos = todos.filter((t) => evaluateTodo(q, t, today));
    return sortTodoRows(todos, sort).map((todo) => ({ kind: "todo", todo }));
  }

  const type: EntityType = tab; // "project" | "ticket"
  let entities = plugin.store.listByType(type);
  if (!filter.showArchived) entities = entities.filter((e) => e.status !== "archived");
  const q = filterToQuery(filter);
  entities = entities.filter((e) => evaluate(q, e, (p) => plugin.store.get(p)?.title, today));
  return sortEntityRows(entities, sort).map((entity) => ({ kind: "entity", entity }));
}
```

#### 3.2.1 フィルタ⇔クエリ文字列 マッピング表

| ManageFilter フィールド | クエリ文字列トークン | 備考 |
|---|---|---|
| `keyword` | フィルタキーを持たない自由語(`ParsedQuery.text`) | 複数語はスペース区切りのままjoin |
| `statuses`(複数) | `status:a,b,c`(カンマ区切りに拡張。`evaluate`のstatus判定はカンマ分割してOR評価する) | 単一値前提だった既存`status:`条件を「複数候補のいずれかに一致」に拡張(後方互換: 単一値もカンマなし文字列として動作) |
| `priorities`(複数) | `priority:a,b` | 同上 |
| `parentPath` | `goal:<title>` または `project:<title>`(タブに応じてどちらか一方) | 既存`matchTitle`をそのまま利用 |
| `period` | `period:today` / `period:week` / `period:overdue` / `period:none` | §1.3で追加した拡張 |
| `tags`(複数) | `tags:a,b` | 既存`tags:`条件をカンマ区切り拡張(statusと同じ方式) |
| `labels`(複数) | `labels:a,b` | 同上 |
| `showDone` | クエリ文字列に含めない(SavedView保存時は別途`viewMode`内の`tab`情報と合わせてUI状態として保持) | 完了済み表示は「一覧の見え方」であり検索条件ではないため |
| `showArchived` | 同上(クエリ文字列に含めない) | 同上 |

- `statuses`/`priorities`/`tags`/`labels`のカンマ区切りOR評価は`domain/query.ts`の`evaluate`/`evaluateTodo`内の該当`case`をカンマ分割+`some()`判定に変更するだけで済む(既存の単一値クエリは1要素配列として動作するため後方互換)
- `showDone`/`showArchived`はクエリ文字列に含めないため、SavedView保存時はこの2つのUI専用フラグを**SavedView型には持たせず**、ManageView側のView生存中ステート(またはタブ別のlocalStorage的な軽量永続化)として扱う。要件§2.5は「タブ+フィルタ+ソート」の保存を求めているため、この2フラグを保存対象外とする判断は**要件へのフィードバック事項**として§9.2に明記する

### 3.3 インライン編集の状態機械

Kanbanの楽観的更新(`kanbanData.ts`の`moveEntityStatus`+`Kanban.svelte`の`move()`)と同一パターンを踏襲する。

```
[表示] --クリック/タップ--> [編集中] --Enter/フォーカスアウト--> [確定中(楽観的更新)]
                                  |                                    |
                                Esc                              成功 / 失敗
                                  |                                    |
                                  v                                    v
                              [表示(元値)]                  [表示(新値)] / [表示(元値)+Notice]
```

- 各セルコンポーネントはローカルに`editing: boolean`と`draftValue`を`$state`で保持する
- 確定時: (1) 表示値を即座に`draftValue`へ差し替え(楽観的更新)、(2) `onCommit(draftValue)`(=`EntityFieldService.updateField`)を`await`、(3) 失敗時は`draftValue`を元値へロールバック+`Notice(t("manage.updateFailed"))`
- 成功時は明示的な再取得を行わない。書き込みが発火する`metadataCache changed`→`Indexer.reindexFile`→`eventBus.emitEvent("index-updated")`をManageViewが購読しており、その再描画で正規の値に収束する(Kanbanと同じ「二重の情報源を持たない」設計)
- Escで取消: `editing = false`、`draftValue`を元値に戻すのみ(書き込みは発生しない)
- Todoのtext/due/priorityインライン編集は`domain/todo.ts`の`updateTodoLine()`(§2.1.1で後述)を使い、`VaultRepository.editLine()`経由で書き込む。既存`TodoService.toggle/remove`と同じ`editLine`不一致時フロー(E003+`Indexer.reindexFile`再実行)に従う

### 3.4 SavedView拡張

```typescript
// settings/settings.ts (変更)
export interface SavedView {
  id: string;
  name: string;
  query: string;
  sort: { key: "due" | "priority" | "title" | "progress"; order: "asc" | "desc" };
  viewMode: "list" | "kanban" | "manage";   // "manage" を追加
  tab?: ManageTab;                          // 追加。viewMode !== "manage" では無視される
}
```

- **後方互換**: 既存`data.json`の`savedViews`は`viewMode: "list" | "kanban"`のみで`tab`フィールドを持たない。TypeScriptの`tab?`はオプショナルのため`JSON.parse`結果にそのまま代入してもエラーにならず、`view.tab`は`undefined`として扱われる。`SavedViewService`側の変更は不要(型定義の追加のみ)
- ManageView側で`SavedView`を適用する際: `viewMode !== "manage"`なら無視(Search.svelteの`applySavedView`は現状通りlist向けの処理を継続)。`viewMode === "manage"`のSavedViewをSearch.svelte(list画面)で選んだ場合は`tab`がなくとも`query`/`sort`は共通形式なので実害はないが、UI上は「ManageViewで開く」導線に限定する(Search.svelteの保存済みView一覧には`viewMode === "manage"`のものを表示しない、またはクリックで自動的にManageViewを開く、のどちらかをB1実装時に決定する。設計上はSavedViewService自体の変更が不要である点のみ確定)
- 保存: `plugin.savedViewService.save({ name, query: filterToQueryString(filter), sort, viewMode: "manage", tab })`
- 復元: `queryStringToFilter(view.query)` で`ManageFilter`を再構築し、`tab: view.tab ?? "project"`で復元する

### 3.5 新規コマンド・リボン・i18nキー

| 種別 | ID / キー | 内容 |
|---|---|---|
| コマンド | `open-manage` | Open Manage(`main.ts`に`registerCommands()`へ追加。`open-kanban`/`open-search`と同一パターンの`getLeavesOfType`→`revealLeaf`/新規leaf) |
| View登録 | `VIEW_TYPE_MANAGE = "pos-manage"` | `registerViews()`に追加 |
| リボン | (任意、要件§2.1) | 本設計では追加しない。既存リボンは1個(Dashboard)のみのため、乱立を避けてコマンドパレット経由を基本とする。ユーザー要望があれば追加は容易(design.md §5.5の方針=デフォルトホットキー設定なしを踏襲) |
| i18nキー | `manage.title` / `manage.tab.projects` / `manage.tab.tickets` / `manage.tab.todos` / `manage.filter.keyword` / `manage.filter.status` / `manage.filter.priority` / `manage.filter.parent` / `manage.filter.period.*`(today/week/overdue/none) / `manage.filter.tags` / `manage.filter.labels` / `manage.filter.showDone` / `manage.filter.showArchived` / `manage.column.*`(title/status/goal/project/priority/progress/due/labels/text/parent) / `manage.emptyState` / `manage.newButton` / `manage.updateFailed` / `manage.rowMenu.promote` / `manage.rowMenu.archive` / `manage.rowMenu.delete` / `manage.rowMenu.deleteConfirm` / `command.openManage` | すべて`src/i18n/ja.ts`の`MESSAGES`定数へ追加(既存パターン踏襲) |

---

## 4. B. 詳細編集(Preview強化)詳細設計

### 4.1 Preview.svelte 改修方針

既存構造(`<details>`によるセクション折りたたみ)は維持しつつ、各`<dd>`表示を「表示 or 編集中」を切り替えるセルコンポーネントに置き換える。

```
Preview.svelte
├── ヘッダ: TitleCell(rename) + type バッジ(編集不可)
├── details「詳細」(open)
│   ├── StatusCell / PriorityCell / DateCell(due, start, review_cycle は別セレクタ)
│   ├── ParentCell(goal) / ParentCell(project)
│   └── Progress(編集不可、既存通り)
├── details「Tags」(新設) — TagChips.svelte
├── details「Labels」(新設) — TagChips.svelte
├── details「Blockers」(既存を編集可能化) — BlockerList.svelte(新設、TagChipsに似るが自由文字列前提)
├── details「Todo」(既存を拡張)
│   ├── 各行: チェックボックス(toggle) / インライン編集(text/due/priority) / 削除 / 昇格ボタン
│   └── フッタ: 「+ Todoを追加」フォーム(その場追加、§4.4)
├── details「配下」(既存を拡張): 子一覧 + 各行のStatusCell + 「+ 新規」ボタン(親を初期セットしたCreateEntityModal)
├── details「Review」(新設): last_reviewed/cycle表示 + 「レビュー実施」ボタン→既存ReviewModal
├── 操作行(新設): Archive / 昇格(Ticketのみ、既存PromoteTicketModal) / 削除(確認ダイアログ)
├── details「未知プロパティ」(新設、閲覧専用): entity.extra のkey-value表示のみ
└── details「本文」(新設): cachedReadの先頭N行(既定20行) + 「ノートで開く」リンク
```

- 折りたたみ状態のデフォルト: 詳細/Todo/配下は`open`、Tags/Labels/Blockers/Review/未知プロパティ/本文は内容が空でない場合のみ`open`(既存Blockersの「0件なら非表示」慣習を踏襲・拡張)
- 解析エラーノートを開いた場合: `entity`が`null`(IndexStore対象外のため)になるので、`PreviewView.buildData()`を拡張し、`plugin.store.getParseErrors()`から該当pathのエラー理由を検索して`PreviewData`に`parseError?: string`を追加。Preview.svelteは`parseError`があれば専用メッセージ(要件§4「詳細パネルで該当ノートを開いた場合はエラー理由を表示」)を表示する

### 4.2 各フィールドの書き込み経路表(要件§3.2の実装レベル化)

| フィールド | UI操作 | 呼び出しService/API | 失敗時の挙動 |
|---|---|---|---|
| status | StatusCell(ドロップダウン) | `EntityService.changeStatus(path, next)`(既存メソッドをそのまま利用。EntityFieldServiceは経由しない — statusは既にライフサイクル操作として`EntityService`に実装済みのため二重実装しない) | `Notice(t("manage.updateFailed"))`+ドロップダウンを元値へロールバック |
| priority | PriorityCell(ドロップダウン) | `EntityFieldService.updateField(path, "priority", value)` | 同上 |
| due / start | DateCell(date input) | `EntityFieldService.updateField(path, "due"/"start", value)` | 同上 |
| review_cycle | ドロップダウン(REVIEW_CYCLES) | `EntityFieldService.updateField(path, "reviewCycle", value)` | 同上 |
| goal / project | ParentCell(サジェスト付きドロップダウン、候補は`store.listByType("goal"/"project")`) | `EntityFieldService.updateField(path, "goal"/"project", targetPath)` | 同上。親変更は旧親・新親双方の`progress`再計算が`Indexer.reindexFile`の`recalcAncestors`で自動的に走る(design.md §4.1のフロー通り、追加実装不要) |
| title | TitleCell(インライン編集) | `EntityFieldService.updateField(path, "title", newTitle)` → 内部で`VaultRepository.renameNote()` | 同上。rename失敗(権限等)は例外→Notice |
| tags / labels | TagChips.svelte(追加/削除) | `EntityFieldService.updateField(path, "tags"/"labels", array)` | 同上 |
| blockers | BlockerList.svelte(追加/編集/削除) | `EntityFieldService.updateField(path, "blockers", array)` | 同上 |
| Todo完了 | チェックボックス | `TodoService.toggle(todo)`(既存) | 既存のE003フロー |
| Todo text/due/priority | インライン編集(TodoTextCell系) | `updateTodoLine()`(domain)で次行を生成 → `VaultRepository.editLine(path, line, expected, next)` | E003フロー(既存`TodoService`と同一パターンをPreview側にも実装。`TodoService`に`updateInline(todo, patch)`メソッドを追加して集約する。§4.5参照) |
| Todo追加 | フッタの追加フォーム | `TodoService.addToSection(path, input)`(新設。§4.4) | 失敗時はNotice、入力欄の内容は保持(再送しやすくする) |
| Todo削除 | 行の削除ボタン | `TodoService.remove(todo)`(既存) | 既存のE003フロー |
| Todo昇格 | 行の「昇格」ボタン | 既存`PromoteTodoModal`をそのまま開く | 既存フロー |
| 配下Entity作成 | 「+ 新規」ボタン | 既存`CreateEntityModal`(`initialType`+親pathを事前設定するオプションを追加。既存`CreateEntityModalOptions`に`initialParentPath?: string`を追加するだけの軽微拡張) | 既存フロー |
| Review実施 | 「レビュー実施」ボタン | 既存`ReviewModal`をそのまま開く | 既存フロー |
| Archive / 昇格(Ticket) / 削除 | 操作行のボタン | `EntityService.archive/delete`、`PromoteService.promoteTicketToProject`(既存) | 既存フロー。削除は`confirm`ダイアログ(Obsidian標準の`Modal`による確認、または`window.confirm`同等のシンプルな確認Modalを`ui/modals/ConfirmModal.ts`として新設) |
| 未知プロパティ(extra) | なし(閲覧専用) | — | — |
| 本文 | なし(閲覧専用+リンク) | `VaultRepository.readBody(path)`の先頭N行を`cachedRead`結果から`slice` | — |

### 4.3 Blockers編集UI

```typescript
// ui/components/BlockerList.svelte (骨格)
// props: { blockers: string[], onCommit: (next: string[]) => Promise<void> }
// - 追加: text input + Enter → [...blockers, trimmed] で onCommit
// - 削除: 各行の × ボタン → blockers.filter((_, idx) => idx !== i) で onCommit
// - 編集: 行クリックでinlineテキスト編集 → 該当indexを置換して onCommit
```

- design.md §3.3の決定(「MVPではリンク解決までは行わず、文字列として表示のみ」)をUI編集でも踏襲する。`[[住宅ローン比較]]`のような文字列はそのまま自由文字列として追加・編集でき、UI側でwikilinkの自動補完・存在チェックは行わない(§9.2フィードバック事項で言及)
- 書き込みは`EntityFieldService.updateField(path, "blockers", nextArray)` → 内部で`repo.updateFrontmatter(path, fm => { fm.blockers = nextArray; })`

### 4.4 「その場でTodo追加」の仕様

`domain/todo.ts`に純粋関数`appendTodoToSection()`を新設し、`TodoService.addToSection()`が`VaultRepository.processBody()`と組み合わせて呼び出す。

```typescript
// domain/todo.ts (追加)
const TODO_SECTION_HEADING = "## Todo";

/**
 * body内の "## Todo" セクション末尾へ line を追記する。
 * - セクションが存在すれば、次の見出し行(先頭が "#")の直前 or 本文末尾までの中で
 *   最後の非空行の直後に挿入する。
 * - セクションが存在しなければ、本文末尾に "\n## Todo\n{line}\n" を追加する(PromoteServiceと同じ形式)。
 * - 見出し表記は "## Todo" への完全一致(大文字小文字区別あり)のみを対象とする(§9.2フィードバック事項)。
 */
export function appendTodoToSection(body: string, line: string): string {
  const lines = body.split("\n");
  const headingIdx = lines.findIndex((l) => l.trim() === TODO_SECTION_HEADING);

  if (headingIdx === -1) {
    const trimmed = body.replace(/\n+$/, "");
    return `${trimmed}\n\n${TODO_SECTION_HEADING}\n${line}\n`;
  }

  let insertAt = headingIdx + 1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break;          // 次の見出しで打ち切り
    if (lines[i].trim() !== "") insertAt = i + 1;     // 非空行の直後を候補に更新
  }
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}
```

```typescript
// services/TodoService.ts (追加メソッド)
async addToSection(path: string, input: { text: string; dueDate?: string; priority?: Priority }): Promise<void> {
  const line = buildTodoLine(input);
  await this.repo.processBody(path, (body) => appendTodoToSection(body, line));
}
```

- `PromoteService.promoteTodoToTicket()`(detail-design.md §4.3)の`## Todo`セクション追記処理は、新Ticketノート＝生成直後の空ノートへの追記のみを扱うため単純結合で足りていた。今回の`appendTodoToSection()`は「既存ノートに既にTodoが複数ある状態への追記」を扱うため境界処理(次見出し検出・末尾改行なし)を新設する。将来的に`PromoteService`側も本関数へ差し替えて重複を解消できるが、本設計のスコープでは「新規追加のみ」とし、既存`PromoteService`の変更は行わない(挙動が変わるリスクを避けるため)

### 4.5 TodoService.updateInline() の追加(text/due/priorityインライン編集)

```typescript
// domain/todo.ts (追加)
export interface TodoPatch {
  text?: string;
  dueDate?: string | null;   // null = 削除
  priority?: Priority | null; // null = 削除
}

/** 既存のstartDate/doneDate/labelsは保持したまま、指定フィールドのみ差し替えた次行を生成する */
export function updateTodoLine(todo: Todo, patch: TodoPatch): string {
  const checkbox = todo.done ? "- [x]" : "- [ ]";
  const indent = todo.indent ?? "";
  const text = (patch.text ?? todo.text).trim();

  let line = `${indent}${checkbox} ${text}`;
  if (todo.startDate) line += ` 🛫 ${todo.startDate}`;
  const due = patch.dueDate === null ? undefined : (patch.dueDate ?? todo.dueDate);
  if (due) line += ` 📅 ${due}`;
  if (todo.doneDate) line += ` ✅ ${todo.doneDate}`;
  const priority = patch.priority === null ? undefined : (patch.priority ?? todo.priority);
  if (priority) line += ` [priority:: ${priority}]`;
  if (todo.labels.length > 0) line += ` [labels:: ${todo.labels.join(", ")}]`;
  return line;
}
```

```typescript
// services/TodoService.ts (追加メソッド。ManageView/Previewの両方から共通利用)
async updateInline(todo: Todo, patch: TodoPatch): Promise<void> {
  const expected = rebuildTodoLine(todo);
  const next = updateTodoLine(todo, patch);
  const result = await this.repo.editLine(todo.filePath, todo.line, expected, next);
  await this.handleMismatch(result, todo.filePath); // 既存private methodを再利用
}
```

- `rebuildTodoLine(todo)`(既存)で「現在ファイル上にあるはずの行」を復元して`expected`とし、`editLine`の照合に使う。これは既存`toggle()`/`remove()`と同一パターン
- 生成される`next`は常に「text → 🛫 → 📅 → ✅ → [priority::] → [labels::]」という固定順序になる。これは既存`buildTodoLine`(QuickAdd)の順序と揃えてあり、「UIで書いたMarkdownが手書きと同一フォーマットになる」(要件§5)を満たす。ただし**元の行の絵文字順序が異なっていた場合(例: 手書きで`📅`が`text`の直後でなく末尾にあった等)は、インライン編集時に正規順序へ正規化される**。これは仕様として許容する(§9.2フィードバック事項)

### 4.6 tags/labelsチップUIとサジェスト

```typescript
// ui/components/TagChips.svelte (骨格)
// props: { values: string[], suggestions: string[], onCommit: (next: string[]) => Promise<void> }
// - 既存値はチップ表示、各チップに×で削除
// - 入力欄: AbstractInputSuggest(既存CreateEntityModalのEntitySuggestと同パターン)でsuggestionsから絞り込み
// - Enter/カンマ区切り入力で追加(重複は無視)
```

- `suggestions`は`IndexStore`に登録済みの全Entityから集計する(`plugin.store.listByType(...)`を全type分呼び出し、`tags`/`labels`をSetでユニーク化)。集計関数`collectKnownTags(store): string[]` / `collectKnownLabels(store): string[]`を`ui/manage/manageData.ts`または`ui/components/`直下の小さなヘルパーファイルに置く(Obsidian非依存にできるため`domain/`側に置いてもよいが、`IndexStore`はinfra層のため、依存方向を守り`services/`または`ui/`側のヘルパーとする)

### 4.7 解析エラーノート表示時の挙動

- `PreviewView.buildData()`: `entity`が見つからない場合、`plugin.store.getParseErrors().find(e => e.path === file.path)`でエラー理由を検索し、`PreviewData.parseError`にセットする
- `Preview.svelte`: `data.entity === null && data.parseError` の場合は「このノートは解析できません: {reason}」+「ノートで開く」リンクを表示(要件§4「詳細パネルで該当ノートを開いた場合はエラー理由を表示」)。それ以外(Entity対象外のノート、Root Directory外など)は既存の`preview.empty`メッセージのまま

---

## 5. エラー処理・機能制限モード

要件§4の実装レベル化。

| 分岐箇所 | 判定 | 動作 |
|---|---|---|
| ManageViewの「Todos」タブ | `plugin.capability.todoFeatures === false` | タブ自体を非表示にし、タブバー末尾に案内バナー(`t("dashboard.todoDisabledNotice")`を流用、または`manage.todoDisabledNotice`を新設)を表示。既存`QuickAddModal`が`todoFeatures`をopts経由で受け取るのと同じ設計(コンストラクタで`plugin.capability.todoFeatures`を渡す) |
| Preview「Todo」セクション | 同上 | セクション自体を非表示+バナー(既存`preview.section.todos`の代わりに`preview.todoDisabledNotice`) |
| Preview「その場でTodo追加」フォーム | 同上 | フォームを非表示(セクション非表示に内包) |
| ManageViewの「Projects」「Tickets」タブ、Preview のEntity系操作全般(プロパティ編集・status変更・Blocker・Archive・Review等) | capability無関係 | 常に動作(要件§4の明記通り) |
| 解析エラーノート | `IndexStore.getParseErrors()`に含まれるpath | ManageView一覧には出さない(そもそも`listByType`/`getAllTodos`はparseErrorのエンティティを含まない実装のため対応不要)。詳細パネルのみ§4.7の通り理由表示 |
| インライン編集の書き込み失敗・行不一致 | `EntityFieldService`の例外 / `editLine`の`"line-mismatch"` | 既存の`Notice`+ロールバック(EntityFieldService起因)/ 既存E003フロー(`editLine`起因)にそのまま従う。新規のエラーコードは追加しない(既存E003で意味的に十分カバーされるため) |
| Todo追加の書き込み失敗 | `processBody`が例外を投げるケース(ファイル削除競合等) | `Notice(t("manage.todoAddFailed"))`。入力欄の内容はクリアしない(再送しやすくする) |
| 全UI文言 | — | `i18n/ja.ts`集約を継続。新規キーは§3.5・本節で列挙 |

- capabilityの変化(`capability-changed`イベント、main.ts:346-356の`refreshCapability()`)をManageView/Preview.svelte双方が購読し、Todosタブ/Todoセクションの表示・非表示をリアクティブに切り替える(Dashboard/QuickAddModalが実装済みの購読パターンをそのまま踏襲)

---

## 6. パフォーマンス設計

要件§5の実装レベル化。

| 対策 | 内容 |
|---|---|
| 描画元 | ManageView/Previewとも`IndexStore`の`listByType`/`getChildren`/`getTodos`/`getAllTodos`のみを参照。ファイルI/Oは行わない(本文プレビューのみ`readBody`=cachedReadを表示時に1回実行、§4.1) |
| 再描画デバウンス | `ManageView`は`KanbanView`と同一の100msデバウンス(`scheduleRefresh()`パターン)を`index-updated`購読に適用する。`Preview`は既存通り`active-leaf-change`+`index-updated`購読(デバウンスなしで問題ない理由: Preview表示対象は常に1エンティティのみで計算量が小さいため既存踏襲) |
| フィルタ・ソート再計算 | Svelteの`$derived`でフィルタ/ソート条件が変わった時のみ`buildManageRows()`を再実行する(既存`Search.svelte`の`runSearch()`明示呼び出し方式ではなく、フィルタ変更を即時反映するリアクティブ方式を採る。理由: 要件§2.4「インライン編集は即時反映」と一覧全体の応答性を優先) |
| 500行描画 | ネイティブ`<table>`+Svelteの`{#each (row.path)}`キー付きループのみで実装し、仮想スクロールは導入しない(要件§5「1タブ500行程度まで体感遅延なし」の範囲内であれば、Kanban/Dashboardと同程度のDOM量で許容できると判断。500行超過時の仮想化は要件§1.3の通りスコープ外) |
| 書き込み時のSelfWriteGuard連携 | `EntityFieldService`/`TodoService`の新規メソッドはすべて`VaultRepository`の既存メソッド(`updateFrontmatter`/`processBody`/`editLine`/`renameNote`)経由でのみ書き込みを行うため、各メソッド内の`selfWriteGuard.markWrite()`呼び出しがそのまま効く。新規に`SelfWriteGuard`を直接操作するコードは書かない(既存の一元管理を崩さない) |

---

## 7. テストケース定義

### 7.1 updateTodoLine (domain/todo.ts)

| # | 入力 | 期待 |
|---|---|---|
| U-1 | `text`のみ変更(due/priorityそのまま) | 元のdue/priorityが維持される |
| U-2 | `dueDate: "2026-07-10"` を新規付与(元Todoにdueなし) | `📅 2026-07-10`が追加される |
| U-3 | `dueDate: null` で既存dueを削除 | `📅`が消える |
| U-4 | `priority: null` で既存priorityを削除 | `[priority::]`が消える |
| U-5 | `labels`が設定されているTodoでtextのみ変更 | `[labels:: ...]`が維持される |
| U-6 | `indent`ありのネストTodo | インデントが維持される |
| U-7 | `startDate`/`doneDate`両方ありのTodo | 両方とも維持され、`due`だけ変更できる |

### 7.2 appendTodoToSection (domain/todo.ts)

| # | 入力body | 期待 |
|---|---|---|
| A-1 | `## Todo`セクションなし | 末尾に`\n## Todo\n{line}\n`が追加される |
| A-2 | `## Todo`セクションに既存Todoが複数行ある | 最後の非空行の直後に挿入される |
| A-3 | `## Todo`の後に別の見出し(`## Note`等)が続く | 見出し直前(セクション内の最後の非空行の直後)に挿入され、後続見出し以降は変更されない |
| A-4 | 本文が改行なしで終わる(末尾改行なし) | 見出しなしケースで`\n\n## Todo\n{line}\n`が正しく付与される(二重改行にならないことを確認) |
| A-5 | `## Todo`セクションが存在するが空(見出し直後がEOFまたは次見出し) | 見出し直後に1行のみ挿入される |

### 7.3 domain/query.ts の period 拡張

| # | クエリ | today | 期待 |
|---|---|---|---|
| PQ-1 | `period:today` | 2026-07-04 | due=2026-07-04のみtrue |
| PQ-2 | `period:week` | 2026-07-04 | due=2026-07-04〜2026-07-11でtrue、07-12でfalse |
| PQ-3 | `period:overdue` | 2026-07-04 | `isOverdue()`と同じ結果になる(status=doneのdue超過エンティティはfalse) |
| PQ-4 | `period:none` | — | dueなしエンティティのみtrue |
| PQ-5 | `status:doing,waiting` | — | statusがdoingまたはwaitingのいずれかでtrue(カンマ区切りOR拡張) |
| PQ-6 | 拡張前の単一値クエリ(`status:doing`) | — | 既存の挙動(完全一致)が変わらないことの回帰確認 |

### 7.4 EntityFieldService.updateField のバリデーション

| # | key | value | 期待 |
|---|---|---|---|
| E-1 | `status` | type別許容値外 | 例外(EntityService.changeStatus経由の既存挙動と同じ) |
| E-2 | `priority` | `"urgent"`(不正値) | 例外 |
| E-3 | `due` | `"2026/07/10"`(形式不正) | 例外 |
| E-4 | `goal` | goal以外のtype(例: ticket)のpath | 例外 |
| E-5 | `title` | 空文字 | 例外 |
| E-6 | `title` | 禁止文字を含む文字列 | `FORBIDDEN_TITLE_CHARS`置換後の安全な文字列でrenameされる |
| E-7 | `tags` | 空配列 | 正常に書き込まれる(tags全削除が可能) |
| E-8 | 未知プロパティが存在するEntityへの`priority`更新 | — | `extra`の内容が書き込み後も保持される(既存`processFrontMatter`の特性の回帰確認) |

### 7.5 SavedView 後方互換

| # | 入力(旧形式JSON) | 期待 |
|---|---|---|
| S-1 | `{ id, name, query, sort, viewMode: "list" }`(`tab`フィールドなし) | 読み込み時にエラーにならず、`view.tab === undefined`として扱われる |
| S-2 | `{ ..., viewMode: "kanban" }` | 既存Kanban向けの復元ロジックに影響しない |
| S-3 | `{ ..., viewMode: "manage", tab: "ticket" }`(新形式) | ManageViewが`tab: "ticket"`で復元される |
| S-4 | `viewMode: "manage"`だが`tab`欠落(手動編集data.json等の異常系) | `tab ?? "project"`のデフォルト補完が効く |

### 7.6 「## Todoセクション検出・作成」の境界(補足、7.2と対応)

- セクションなし/既存あり/末尾改行なしは7.2のA-1/A-2/A-4で網羅
- 見出し表記ゆれ(`## TODO`大文字、`### Todo`レベル違い)は**非対応**として明示的にテストする: `appendTodoToSection`は`## Todo`完全一致以外を検出しないため、`## TODO`が既にあるノートでは「セクションなし」として扱われ、末尾に新たな`## Todo`セクションが追加される(重複見出しが生まれる)。この挙動は仕様として許容し、§9.2フィードバック事項に明記する

---

## 8. 実装フェーズ計画

依存関係を踏まえ、既存detail-design.md §10のPhase 1〜7の後続として「Phase A/B」を追加する。

| Phase | 内容 | 依存 | 成果物・テスト |
|---|---|---|---|
| **A1: 共通基盤** | `domain/todo.ts`(`updateTodoLine`/`appendTodoToSection`)、`domain/date.ts`(`addDays`)、`domain/query.ts`(period拡張+カンマ区切りOR拡張)、`VaultRepository.renameNote()`、`EntityFieldService`新設 | 既存MVP全Phase | Vitest: §7.1/7.2/7.3/7.4。既存query.tsの回帰テスト(PQ-6)必須 |
| **A2: 管理View一覧+フィルタ** | `ui/manage/`一式(ManageView.ts/Manage.svelte/manageData.ts)、読み取り専用の一覧表示+フィルタ+ソート、`open-manage`コマンド | A1 | 手動確認: 3タブの一覧・フィルタ・ソートが機能すること |
| **A3: インライン編集+行メニュー** | `ui/components/`共通セルコンポーネント一式、ManageRowへの組み込み、`RowMenu`(昇格/Archive/削除)、「+新規」ボタン、SavedView連携(§3.4) | A2 | 手動確認: 受け入れ基準3〜6(要件§6)。SavedView後方互換テスト(§7.5) |
| **B1: Preview編集化** | Preview.svelte全面改修(Title/Status/Priority/Date/Parent各セル組み込み、Tags/Labels/Blockers編集)、`ui/components/TagChips.svelte`/`BlockerList.svelte` | A1(EntityFieldService)、A3で作成した共通セルコンポーネントを再利用 | 手動確認: 受け入れ基準7、10 |
| **B2: Todo追加・配下・Review** | Preview「Todo」セクション拡張(追加/削除/昇格)、`TodoService.addToSection`/`updateInline`、「配下」セクションの「+新規」(CreateEntityModalへの`initialParentPath`拡張)、「Review」ボタン、本文プレビュー、`ConfirmModal`新設 | B1 | 手動確認: 受け入れ基準8、9 |
| **仕上げ** | SavedViewの`manage`⇔`list`表示切り分け、capability分岐の全箇所確認(§5表)、解析エラーノートの詳細パネル表示(§4.7)、i18nキー総点検、モバイルタップ操作確認、要件§6受け入れ基準15項目の1件ずつのチェックリスト化 | A1〜B2 全て | 受け入れ基準1〜15(要件§6)を全項目チェック |

---

## 9. 補足

### 9.1 まとめ: EntityFieldService新設の是非(再掲)

新設する。理由は§2.2の通り、(1) ManageView一覧とPreview詳細の2箇所からの重複呼び出しの解消、(2) 既存`EntityService`の責務(ライフサイクル操作)と新規責務(汎用プロパティ編集)の分離、(3) バリデーションの一元化、(4) titleのrename特例の隠蔽。ただし`status`変更のみは既存`EntityService.changeStatus()`(progress再計算トリガ・バリデーション込み)をそのまま使い、`EntityFieldService`では扱わない(二重実装回避)。

### 9.2 要件定義書へのフィードバック事項

design.md §9.2と同じ流儀で、本設計の過程で判明した要件定義書v1.0(requirements-ui-first.md)への反映推奨事項を記載する。

1. **§2.3 期間フィルタの意味論が未定義**: 「Overdue」が(a) due超過のみを見るのか、(b) Dashboard/judge.tsの`isOverdue()`と同じく「未完了status(open)」条件も含むのか、要件文面からは判断できなかった。本設計では**judge.isOverdueと同一意味論**(status openかつdue超過)に統一した。要件書に明記することを推奨する
2. **§2.5 SavedView拡張で「完了済み表示」「archived表示」の保存要否が未定義**: 要件§6-6は「タブ+フィルタ+ソート」の保存を求めるが、`showDone`/`showArchived`をフィルタに含めるかは記載がない。本設計ではこの2つを**クエリ文字列に含めず、SavedView保存対象外**とした(表示上のトグルであり検索条件ではないと判断)。要件側で「保存対象に含めるか」を明記することを推奨する
3. **§3.2 Blockers編集のwikilink許容と自動サジェストの要否が未定義**: 要件は「自由文字列+wikilink文字列可」とのみ記載されるが、UI上でwikilinkの自動補完・存在チェック(サジェスト)を提供するかは明記がない。既存design.md §3.3の決定(MVPではリンク解決を行わず文字列表示のみ)を踏襲し、本設計では**サジェストなしの自由文字列編集**とした。将来のリンク解決対応が必要なら別途要件化を推奨する
4. **§2.4 goal/project(親)変更の副作用が未記載**: ManageView/PreviewでのGoal/Project変更は、旧親・新親双方のprogress再計算という既存`ProgressService`のフロー(design.md §4.1)を誘発する。この副作用自体は既存基盤で自動的に処理されるため実装上の懸念はないが、要件側に「親変更時は進捗が再計算される」旨を明記することを推奨する(ユーザー向けの挙動説明としても有用)
5. **§2.4 Titleインライン編集時のファイル名衝突ルールが未定義**: 要件は「禁止文字は既存ルール置換」とのみ記載するが、rename先に同名ファイルが既に存在する場合の挙動(サフィックス付与か、エラーにするか)が未定義だった。本設計では`VaultRepository.renameNote()`に既存`createEntityNote`/`moveToFolder`と同じ「サフィックス付与で回避」方式を採用した。要件側への追記を推奨する
6. **§3.2「その場でTodo追加」のセクション見出し表記ゆれへの対応が未定義**: 既存ノートで`## TODO`（大文字）等の表記ゆれがあった場合の扱いが要件に無い。本設計では`## Todo`への完全一致(大文字小文字区別)のみを検出対象とし、非一致時は新たな`## Todo`セクションを追加する(見出し重複が起こり得る)仕様とした。運用上問題があれば要件側で見出し表記を確定的に定義することを推奨する
7. **§3.2 Todoインライン編集時のメタデータ順序正規化**: 手書きTodoの絵文字メタデータ順序が既存の`buildTodoLine`規約(text→🛫→📅→✅→priority→labels)と異なっていた場合、インライン編集(text/due/priority変更)を1回行うだけで行全体が正規順序に書き換わる。「UIで書いたMarkdownが手書きと同一フォーマットになる」(要件§5)という原則と、「意図しない箇所まで差分が生じる」というGit差分最小化の観点がやや相反するため、要件側でこの正規化を許容するかどうかの方針確認を推奨する
