# Obsidian Personal OS Plugin ドリルダウンナビゲーション 設計書 v1.0

- 版数: v1.0
- 作成日: 2026-07-04
- 対応要件: ドリルダウンナビゲーション 要件定義書 v1.0(requirements-drilldown-nav.md、v1.0承認済み)
- 対応既存設計: 基本設計書 v1.0(design.md)/ 詳細設計書 v1.0(detail-design.md)/ UIファースト操作 設計書 v1.0(design-ui-first.md)
- 位置づけ: design-ui-first.md §3(統合管理View 詳細設計)を本書で**全面改訂**する。§1・§2・§4・§5・§6(EntityFieldService新設・VaultRepository.renameNote・Preview強化)はそのまま有効。本書はそれらへの追補として、design-ui-first.mdと同じ流儀(方針→ナビゲーション設計→画面詳細→テスト→フェーズ計画)で記述する

本書執筆時点で、design-ui-first.md記載の骨格を上回る実装がすでに存在する(`EntityFieldService`・`ConfirmModal`・`TodoService.updateInline/addToSection`・`ManageFilterBar`のフィルタ複数選択UI等)。本書はコード上の実名・現状のシグネチャに基づいて記述する。

---

## 1. 設計方針

### 1.1 「作り替え」の範囲

| 対象 | 扱い |
|---|---|
| `ManageView.ts`(`ItemView`ラッパ、`refreshToken` Writable、100msデバウンス購読) | **シェルは維持**。`index-updated`購読部分のみ、payload(rename情報)を捨てずに受け取るよう拡張する(§2.4) |
| `Manage.svelte`(Svelteツリーのルート) | **内部を全面差し替え**。`tab: ManageTab` state + `ManageFilterBar`+`ManageTable`という「タブ+テーブル」構成を、`ManageScreen`の**画面スタック**+パンくず+スタック先頭の画面コンポーネントを描画する構成へ置き換える |
| `ManageFilterBar.svelte` / `ManageTable.svelte` / `ManageRow.svelte` | **流用**。`ManageFilterBar`は「プロジェクト一覧画面」「プロジェクト詳細のチケット一覧」「詳細画面のTodo一覧」から個別に呼ばれる形になるため、既存の`{plugin, tab, filter, onChange}`シグネチャのまま使い回せる(tab値を`"project"`/`"ticket"`固定で渡すだけ)。`ManageTable`/`ManageRow`も同様に`tab`を固定値で渡せば無改造で使える |
| `manageData.ts`のフィルタ・ソート純粋関数(`filterToQuery`/`filterToQueryString`/`queryStringToFilter`/`sortEntityRows`/`sortTodoRows`/`collectKnownTags`/`collectKnownLabels`) | **フル流用**。`buildManageRows`の`tab === "todo"`分岐(グローバルTodo一覧)のみ削除する(§1.2) |
| `ui/components/`(StatusCell/PriorityCell/DateCell/ParentCell/TitleCell/TagChips/BlockerList/RowMenu) | **無改造で流用**。すべて`{value/values/blockers, options?, onCommit}`という値渡し形式のため、呼び出し元がManageRowだろうと新設の詳細ページだろうと関係なく動く |
| `Preview.svelte` | **Todoセクションのみ小改修**(§3.4で共通化する`TodoList.svelte`への差し替え)。それ以外(ヘッダ/詳細/Tags/Labels/Blockers/配下/Review/未知プロパティ/本文)は無改造 |

### 1.2 削除するもの・失われる機能の確認

| 削除対象 | 失われる機能 | 代替 |
|---|---|---|
| `Manage.svelte`のタブ切替ボタン(`pos-manage-tabs`)、`ManageTab`型の`"project"/"ticket"/"todo"`という並列概念 | タブという操作単位そのもの | 画面スタックによるドリルダウンに置き換え。「チケットだけ全部見る」操作は、プロジェクト詳細を経由するかSavedViewの絞り込み一覧(旧`tab:"ticket"`のSavedView)経由でカバーする(§5で互換方針を確定) |
| `manageData.ts`の`buildManageRows`内`tab === "todo"`分岐(グローバルTodo一覧。全Ticket/Project/Inboxの未完了Todoを1画面に集約する機能) | 「Todoだけを横断的に一覧する」画面 | 要件書冒頭(requirements-drilldown-nav.md §1.1)の通り、DashboardのToday's Todo Widget / Overdue Widgetが「今日やる/遅延している」という横断軸を代替する。「全Todoの一覧」相当が必要な場合はSearch.svelte(既存のtype:todo検索、本書スコープ外)を使う運用とする |
| `Manage.svelte`のTodoタブ用SavedView(`tab: "todo"`) | Todo横断一覧のフィルタ保存 | §5で「pickerから非表示、データは破棄しない」方針を確定 |

---

## 2. ナビゲーション状態設計

本設計の心臓部。`ui/manage/manageNav.ts`(新設、Obsidian非依存の純粋関数群)と`Manage.svelte`の`$state`配線に分けて設計する。

### 2.1 画面スタックの型

```typescript
// ui/manage/manageNav.ts (新設)
export type ManageScreen =
  | { kind: "project-list" }
  | {
      kind: "project-detail";
      path: string;
      // ページ内設定(§2.3で後述): このフレーム固有、他のproject-detailフレームとは共有しない
      ticketFilter: ManageFilter;
      ticketSort: ManageSort;
      todoScope: "direct" | "all";
      showDoneTodos: boolean;
    }
  | { kind: "ticket-detail"; path: string; showDoneTodos: boolean };

export function makeProjectDetailScreen(path: string): ManageScreen {
  return {
    kind: "project-detail",
    path,
    ticketFilter: { ...EMPTY_MANAGE_FILTER },
    ticketSort: { ...DEFAULT_ENTITY_SORT },
    todoScope: "direct",
    showDoneTodos: false,
  };
}

export function makeTicketDetailScreen(path: string): ManageScreen {
  return { kind: "ticket-detail", path, showDoneTodos: false };
}
```

- `project-list`はスタックの**常に先頭(index 0)固定**。空にできない・popできない画面として扱う(パンくずの起点)
- `project-detail`/`ticket-detail`はそれぞれ自分専用のページ内UI状態(フィルタ/ソート/Todo範囲/完了トグル)を**フレーム自身のフィールドとして内包**する。Svelte 5の`$state`はネストしたオブジェクト/配列も深くリアクティブになるため、`stack: ManageScreen[]`を丸ごと`$state`にするだけで各フレーム内フィールドの変更も再描画に反映される

### 2.2 スタック操作(純粋関数、Vitest対象)

```typescript
// ui/manage/manageNav.ts (続き)
/** 末尾に新しい画面を積む(常に新規状態で積む。同一pathの既存フレームがあっても再利用しない、§2.5参照) */
export function pushScreen(stack: ManageScreen[], screen: ManageScreen): ManageScreen[] {
  return [...stack, screen];
}

/** パンくずの index 番目までを残す(0 = project-list のみ)。index が範囲外なら変化なし */
export function popTo(stack: ManageScreen[], index: number): ManageScreen[] {
  if (index < 0 || index >= stack.length) return stack;
  return stack.slice(0, index + 1);
}

/** 「← 戻る」= 一つ上の階層へ */
export function popOne(stack: ManageScreen[]): ManageScreen[] {
  return popTo(stack, stack.length - 2);
}

export function screenPath(screen: ManageScreen): string | undefined {
  return screen.kind === "project-list" ? undefined : screen.path;
}

export function expectedTypeOf(screen: ManageScreen): EntityType | undefined {
  if (screen.kind === "project-detail") return "project";
  if (screen.kind === "ticket-detail") return "ticket";
  return undefined;
}
```

- `Manage.svelte`側の呼び出しは `stack = pushScreen(stack, makeProjectDetailScreen(path))` のように、常に新しい配列を`$state`へ代入する形で行う(既存Kanban/Manageの「新しい値を代入して再描画」という流儀と同じ)
- パンくずUIは `stack.map((s, i) => ({ label: breadcrumbLabel(plugin, s), onClick: () => (stack = popTo(stack, i)) }))` で構築する。`breadcrumbLabel`は`project-list`なら`t("manage.title")`、detail系なら`plugin.store.get(s.path)?.title ?? t("manage.nav.unknown")`
- 「← 戻る」ボタンは `stack.length > 1` のときのみ表示し、`stack = popOne(stack)` を呼ぶ

### 2.3 画面ごとの状態保持設計(要件§3.3への対応)

| 状態 | 保持場所 | 理由 |
|---|---|---|
| プロジェクト一覧のフィルタ・ソート・Goalセクション折りたたみ状態 | `Manage.svelte`トップレベルの`$state`(スタック配列**外**)。例: `let listFilter = $state({ ...EMPTY_MANAGE_FILTER })`, `let listSort = $state({ ...DEFAULT_ENTITY_SORT })`, `let collapsedGoals = $state(new Set<string>())` | project-listはスタックの先頭に常在し、push/popで破棄・再生成されることがない唯一の画面。「詳細→一覧へ戻ってもフィルタが消えない」(要件§3.3)は、この状態を**そもそも一覧画面の生成・破棄と紐付けない**ことで自明に満たす |
| プロジェクト詳細のチケット一覧フィルタ・ソート、Todo範囲トグル、完了済み表示トグル | `ManageScreen`(`kind: "project-detail"`)フレーム自身のフィールド(§2.1) | 同一フレームを指したまま(=同じProjectを表示したまま)チケット一覧を絞り込んでTodo一覧を見て戻る、という操作はフレームが破棄されないため保持される。**別のプロジェクトへ移る**=`pushScreen`で**新しいフレームを生成**するため、`makeProjectDetailScreen`のデフォルト値に戻る(要件§3.3「別プロジェクトに移ったらページ内設定リセット」を、pushのたびに新規オブジェクトを作るという実装でそのまま満たす) |
| チケット詳細の完了済み表示トグル | 同様に`ManageScreen`(`kind: "ticket-detail"`)フレーム自身のフィールド | 同上 |

- パンくずで**同じフレームへジャンプ**する場合(`popTo`)は配列を切り詰めるだけでオブジェクト自体は再生成しないため、そのフレームのページ内設定は保持される。これが「戻ってもフィルタ保持」の実体
- 一覧画面から**同じプロジェクトを再度クリックして**detailへ入り直した場合は、`pushScreen(stack, makeProjectDetailScreen(path))`で**新規フレーム**が積まれるため、ページ内設定はデフォルトへ戻る。「一覧経由の再訪問は新規訪問として扱う」という単純なルールに統一する(要件へのフィードバック事項として§9.2に明記)

### 2.4 表示中Entity削除/Archive時の自動巻き戻し(要件§3.5)

`index-updated`イベントのpayloadは`Indexer`実装(`src/infra/Indexer.ts`)ですでに次の形で発火している(本設計以前から存在):

- `reindexFile`: `[file.path]`
- `handleRename`: `[oldPath, file.path]`(**rename元/rename先の両方**を含む。Title変更・PromoteTicketToProjectの`moveToFolder`経由の移動どちらもここを通る)
- `handleDelete`: `[file.path]`
- `fullScan`: payloadなし

現状の`ManageView.ts`はpayloadを`() => this.scheduleRefresh()`と**捨てている**。本設計ではこれを使う。

```typescript
// ManageView.ts (変更)
private pendingRenames: Array<[string, string]> = [];
private refreshToken: Writable<{ token: number; renames: Array<[string, string]> }> =
  writable({ token: 0, renames: [] });

async onOpen(): Promise<void> {
  this.component = mount(Manage as SvelteComponent, {
    target: this.contentEl,
    props: { plugin: this.plugin, refreshToken: this.refreshToken, navigateRequest: this.navigateRequest },
  });
  this.registerEvent(
    this.plugin.eventBus.onEvent("index-updated", (payload) => {
      if (Array.isArray(payload) && payload.length === 2) this.pendingRenames.push(payload as [string, string]);
      this.scheduleRefresh();
    })
  );
  // settings-updated / capability-changed 購読は変更なし
}

private scheduleRefresh(): void {
  if (this.debounceTimer !== undefined) window.clearTimeout(this.debounceTimer);
  this.debounceTimer = window.setTimeout(() => {
    this.debounceTimer = undefined;
    const renames = this.pendingRenames;
    this.pendingRenames = [];
    this.refreshToken.update((s) => ({ token: s.token + 1, renames }));
  }, REFRESH_DEBOUNCE_MS);
}
```

- 100msデバウンス窓の間に複数の`index-updated`が来ても、rename情報は`pendingRenames`に蓄積してから一括でSvelte側へ渡す(取りこぼし防止)

`Manage.svelte`側の検証ロジック(純粋関数化、`manageNav.ts`に置く):

```typescript
// ui/manage/manageNav.ts (続き)
/**
 * rename追従+消滅検証。stack[0](project-list)は対象外。
 * 1. renamesに一致するold pathを持つフレームは、型が一致する限りpathを書き換える(Title変更・昇格移動どちらもここで追従)
 * 2. 残ったフレームのうち、store.get(path)が存在しない/status==="archived"/expectedTypeOfと型不一致 のものが
 *    現れた最初のindexで打ち切る(それ以降は消す)
 * 戻り値: 新しいstackと、打ち切りが発生した場合のみ理由(Notice文言生成用)
 */
export function reconcileStack(
  stack: ManageScreen[],
  store: IndexStore,
  renames: Array<[string, string]>
): { stack: ManageScreen[]; truncated: boolean } {
  let next = stack.map((screen) => {
    if (screen.kind === "project-list") return screen;
    const hit = renames.find(([oldPath]) => oldPath === screen.path);
    if (!hit) return screen;
    const [, newPath] = hit;
    const entity = store.get(newPath);
    if (entity && entity.type === expectedTypeOf(screen)) return { ...screen, path: newPath };
    return screen; // 型不一致(例: 昇格でticket→project)は書き換えず、次の検証ステップで消滅扱いにする
  });

  for (let i = 1; i < next.length; i++) {
    const screen = next[i];
    const entity = store.get(screenPath(screen)!);
    const valid = !!entity && entity.status !== "archived" && entity.type === expectedTypeOf(screen);
    if (!valid) return { stack: next.slice(0, i), truncated: true };
  }
  return { stack: next, truncated: false };
}
```

- `Manage.svelte`は`refreshToken`が更新されるたびに`reconcileStack(stack, plugin.store, token.renames)`を呼び、`truncated`なら`new Notice(t("manage.nav.entityGone"))`を出す。rename追従(pathの書き換え)は無音で行う(ユーザー操作としては「同じものを見続けている」ため通知不要)
- **Ticket→Project昇格(`PromoteService.promoteTicketToProject`)時の挙動**: このメソッドは新パスを呼び出し元に返さない(戻り値`void`。内部で`repo.moveToFolder`を呼ぶのみ)。そのため`ticket-detail`フレームが表示中に昇格が起きた場合、rename追従ステップでは`entity.type`が`"project"`になり`expectedTypeOf(screen)`(`"ticket"`)と不一致となるため**書き換えは行われず**、次の検証ステップで「消滅」として扱われ`ticket-detail`より上のフレームがすべて切り捨てられる(=プロジェクト詳細 or 一覧へ戻る)。これは要件§3.5の「一つ上の階層へ自動で戻る」を型不一致ケースにも一貫して適用した結果であり、意図した挙動とする(§9.2フィードバック事項3)
- Title変更のみ(型不変)のrenameは`{ ...screen, path: newPath }`でその場追従するため、詳細ページを見ている最中にTitleCellでタイトルを変えても画面が消えない

### 2.5 外部からの遷移API

```typescript
// ManageView.ts (追加)
private navigateRequest: Writable<{ token: number; screen: ManageScreen } | null> = writable(null);
private navToken = 0;

/** 外部(Dashboard等)から呼ぶ。開いていなければ開いてから遷移する(main.ts側で担保、下記参照) */
navigateTo(screen: ManageScreen): void {
  this.navigateRequest.set({ token: ++this.navToken, screen });
}
```

```typescript
// main.ts (追加。既存 openManage() と同じ get-leaves-or-create パターンを踏襲)
async openManageAt(screen: ManageScreen): Promise<void> {
  const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MANAGE);
  let leaf: WorkspaceLeaf;
  if (existing.length > 0) {
    leaf = existing[0];
  } else {
    leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_MANAGE, active: true });
  }
  this.app.workspace.revealLeaf(leaf);
  if (leaf.view instanceof ManageView) leaf.view.navigateTo(screen);
}
```

- `Manage.svelte`は`navigateRequest`の`token`変化を`$effect`で監視し、変化があれば **スタックを`[{kind:"project-list"}, screen]`へリセット**する(現在の深いスタックを保持せず、常に「一覧→対象」という2階層のパンくずから始める)。理由: Dashboardからのジャンプは「今どこを見ていたか」と無関係な独立操作であり、直前の深いドリルダウン状態を引きずるとパンくずの意味が破綻するため
- View未オープン時に`setViewState`後すぐ`leaf.view`にアクセスするのは、Obsidianの`ItemView`が`setViewState`のPromise解決時点でView自身の構築(コンストラクタ)は完了している(mountは`onOpen`内、非同期だが`Writable`はコンストラクタで生成済み)という既存実装(`ManageView`のフィールド初期化がコンストラクタ相当のクラスフィールドで行われる、`ManageView.ts:13-16`)に依拠する。`navigateRequest`もコンストラクタ相当のクラスフィールドとして持たせるため、`onOpen`(Svelteマウント)より前に`navigateTo`が呼ばれても値は保持され、マウント後の初期`$effect`実行時に読み出される

---

## 3. 画面詳細設計

### 3.1 プロジェクト一覧(ルート画面、`ProjectListScreen.svelte`)

**データ構築**(`ui/manage/manageData.ts`に追加):

```typescript
export interface GoalGroup {
  goal: Entity | null; // null = 未分類
  projects: Entity[];
}

/** Goalごとにグルーピングする。goalのstatus順(active→paused→done→archived)→title順。未分類は末尾固定 */
export function groupProjectsByGoal(plugin: PersonalOSPlugin, filter: ManageFilter, sort: ManageSort): GoalGroup[] {
  const rows = buildManageRows(plugin, "project", filter, sort); // 既存関数をtab固定で流用
  const byGoal = new Map<string | null, Entity[]>();
  for (const row of rows) {
    const key = row.entity!.goal ?? null;
    if (!byGoal.has(key)) byGoal.set(key, []);
    byGoal.get(key)!.push(row.entity!);
  }
  const goalRank = (g: Entity | null) => (g ? GOAL_STATUS_RANK[g.status] ?? 99 : 100);
  const groups: GoalGroup[] = Array.from(byGoal.entries()).map(([path, projects]) => ({
    goal: path ? (plugin.store.get(path) ?? null) : null,
    projects,
  }));
  return groups.sort((a, b) => {
    const r = goalRank(a.goal) - goalRank(b.goal);
    return r !== 0 ? r : (a.goal?.title ?? "￿").localeCompare(b.goal?.title ?? "￿");
  });
}
```

- `buildManageRows(plugin, "project", filter, sort)`は現行のまま(`tab`を`"project"`固定で呼ぶだけ)流用できる。フィルタ・ソート・archived除外ロジックは変更不要
- Goalが**削除された場合**(Projectの`goal`フィールドが指す先がIndexStoreに存在しない不整合データ)は`plugin.store.get(path) ?? null`により**未分類扱い**にフォールバックする(壊れたリンクでクラッシュしない)

**UI構成**:

```
ProjectListScreen.svelte
├── ManageFilterBar(tab="project", filter=listFilter, onChange)   -- 流用。parentPath(goal)フィルタは
│                                                                     グルーピングと機能重複するため非表示にする
│                                                                     (下記「差分」参照)
├── {#each groupProjectsByGoal(...) as group}
│   ├── <button> Goalヘッダ(goal.title + status + `{projects.length}件` + 折りたたみ▶/▼) onclick→collapsedGoals.toggle
│   └── {#if !collapsed}
│       ├── ManageTable(tab="project", rows=group.projects.map(entity=>({kind:"entity",entity,...})), sort=listSort, onOpen)
│       │     -- onOpen(既存のnote直開き)ではなく、Title列クリックはonNavigate(path)=push(project-detail)に差し替える(§3.1.1)
│       └── 「+ 新規プロジェクト」(このGoalを初期goalにしたCreateEntityModal)
│   {/each}
```

#### 3.1.1 ManageRowのクリック挙動の分岐(既存からの変更点)

現行`ManageRow.svelte`のTitleCellは`onCommit`(rename)のみを持ち、行クリックでの遷移は`RowMenu`の「ノートを開く」経由のみだった。ドリルダウンでは**Title部クリックで詳細へ遷移**(要件§2.2)する必要があるため、`ManageRow`に遷移用propを追加する:

```typescript
// ManageRow.svelte (props追加)
let {
  row, tab, plugin, onOpen,
  onNavigate, // 追加。undefinedなら従来通り遷移なし(TitleCellのクリックはrename編集のみ)
}: {
  ...
  onNavigate？: (path: string) => void;
} = $props();
```

- Title表示部分(非編集時のバッジ)にクリックハンドラを追加: `onclick={() => onNavigate ? onNavigate(entity.path) : (editing = true)}`という単純な分岐ではなく、**TitleCell自体はrename編集の入力欄を持つコンポーネント**であるため、「クリックで詳細へ」と「クリックでインライン編集」が同じ要素上で衝突する。これを避けるため、**行のTitle列セルはTitleCellをそのまま維持しつつ、行の他の空白部分(`<tr>`のクリック、ただし操作用セル内のクリックは`stopPropagation`)をクリックすると`onNavigate`が呼ばれる**方式にする。具体的には`<tr onclick={() => onNavigate?.(entity.path)}>`とし、TitleCell/StatusCell/PriorityCell等の各セルの`<td>`に`onclick={(e) => e.stopPropagation()}`を追加する(インライン編集セルは編集操作を、それ以外の余白クリックは詳細遷移を担当する、という責務分離)
- Todo行(`row.kind === "todo"`)には`onNavigate`は渡さない(Todo自体に詳細画面はない。所属バッジのクリックは従来通り`onOpen`系のロジックを使うが、詳細設計は§3.2で述べる通り「所属Ticket詳細への遷移」に差し替える)

**フィルタバー差分**: `ManageFilterBar`の`parentOptions`(goalドロップダウン)は、Goalグルーピングで同じ絞り込みが視覚的にすでに提供されているため、プロジェクト一覧画面では**非表示にする**方が情報の重複がなく素直である。実装は`ManageFilterBar`に`showParentFilter?: boolean`(デフォルト`true`)を追加し、プロジェクト一覧からは`showParentFilter={false}`を渡す(既存の呼び出し元であるプロジェクト詳細のチケット一覧では従来通り`true`のまま = チケット一覧では「project:」フィルタ自体が固定されているので実質使われないため、そちらも`false`にする。§3.2参照)。`showDone`トグルは元々`tab==="todo"`限定表示のため触れる必要はない

**「+ 新規プロジェクト」ボタン**(Goalセクション内): 既存`CreateEntityModal`の`initialParentPath`オプション(design-ui-first.md §4.2で追加済み)をそのまま使い、`initialType: "project", initialParentPath: group.goal?.path`を渡す

**行メニュー**: 既存`RowMenu`をそのまま流用(ノートを開く/Previewに表示/Archive/削除)。Projectには昇格がないため`onPromote`は渡さない(現行`ManageRow`のまま)

### 3.2 プロジェクト詳細(`ProjectDetailScreen.svelte`)

**ヘッダ**: パンくず(§2.2)+ `TitleCell`(rename)+ type バッジ + 主要プロパティ行(`StatusCell`/`PriorityCell`/`DateCell(due)`/`ParentCell(goal)`/Progressバー、すべてPreview.svelteの「詳細」セクションと同一の書き込み経路・同一コンポーネント)+「ノートを開く」ボタン。Preview.svelteのヘッダと完全に同一パターンだが、**共通コンポーネント化はしない**(§3.5で判断根拠を述べる)

**チケット一覧セクション**:
```typescript
// manageData.ts に追加、または既存buildManageRowsの型を絞って再利用
const ticketRows = buildManageRows(plugin, "ticket", screen.ticketFilter, screen.ticketSort)
  .filter((row) => row.entity!.project === projectPath); // ★プロジェクト詳細固有の絞り込み
```
- 既存`buildManageRows(plugin, "ticket", filter, sort)`は「全Ticket」を返す関数のため、プロジェクト詳細では**そのプロジェクトの子のみ**に絞る後段フィルタを追加する。あるいは`plugin.store.getChildren(projectPath)`(IndexStore既存メソッド、typeを問わず子を返す)を起点に`.filter(e => e.type === "ticket")`してから既存の`evaluate`/`sortEntityRows`を適用する方が「全件スキャンしてから絞る」より意味的に素直なため、後者を採用する:
```typescript
export function buildProjectTicketRows(
  plugin: PersonalOSPlugin, projectPath: string, filter: ManageFilter, sort: ManageSort
): ManageRowData[] {
  let tickets = plugin.store.getChildren(projectPath).filter((e): e is Entity => e.type === "ticket");
  if (!filter.showArchived) tickets = tickets.filter((e) => e.status !== "archived");
  const q = filterToQuery(filter, "ticket");
  tickets = tickets.filter((e) => evaluate(q, e, (p) => plugin.store.get(p)?.title));
  return sortEntityRows(tickets, sort).map((entity) => ({ kind: "entity", entity }));
}
```
- `ManageTable(tab="ticket", rows=buildProjectTicketRows(...), sort=screen.ticketSort, onSortChange=(k)=>screen.ticketSort=...)` + `ManageRow`に`onNavigate={(path) => stack = pushScreen(stack, makeTicketDetailScreen(path))}`
- 「+ 新規チケット」: `CreateEntityModal`に`initialType:"ticket", initialParentPath: projectPath`
- 行メニュー: 既存のまま(昇格/Archive/削除、Ticketには`onPromote`あり)

**Todo一覧セクション(表示範囲切替トグル付き)**:
```typescript
/** direct: このProject直下のTodoのみ。all: 直下+配下の非archivedチケット全ての未完了Todoを集約 */
export function collectProjectTodos(store: IndexStore, projectPath: string, scope: "direct" | "all"): Todo[] {
  const direct = store.getTodos(projectPath);
  if (scope === "direct") return direct;
  const ticketTodos = store
    .getChildren(projectPath)
    .filter((e) => e.type === "ticket" && e.status !== "archived")
    .flatMap((ticket) => store.getTodos(ticket.path));
  return [...direct, ...ticketTodos];
}
```
- 「直下/すべて」トグルは`screen.todoScope`を切り替えるボタン2つ(design-ui-first.md流に`ManageFilterBar`のチップボタンと同じ見た目)
- Todoの表示・操作(完了トグル/インライン編集/削除/昇格/追加フォーム)は**共通部品`TodoList.svelte`**(§3.4)を使う。`showParentBadge={scope === "all"}`を渡し、バッジクリックで`todo.parentPath`(ticket path)へ`pushScreen(stack, makeTicketDetailScreen(todo.parentPath))`する(`todo.parentType === "ticket"`の場合のみバッジ+クリック可能。`parentType === "project"`(直下Todo)はバッジなし)
- 完了済み表示トグルは`screen.showDoneTodos`
- 「+ Todoを追加」: `TodoList`の`addTarget={projectPath}`(常に直下Todoとして追加、既存`TodoService.addToSection`のまま)

### 3.3 チケット詳細(`TicketDetailScreen.svelte`)

- ヘッダ: パンくず+`TitleCell`+バッジ+主要プロパティ(`StatusCell`/`PriorityCell`/`DateCell(due)`/`ParentCell(project)`/Progress)+**Blockers表示**+「ノートを開く」
- **Blockers**: 閲覧+編集の両方を提供する。理由: `BlockerList.svelte`は既に`{blockers, onCommit}`という値渡しの汎用コンポーネントであり、書き込み先も`EntityFieldService.updateField(path, "blockers", next)`でエンティティ種別を問わない。要件§3.1「第1次機能追加の操作は各画面でも同等に使えること(機能後退させない)」を素直に満たすには編集可能にする方が一貫している。閲覧専用にする技術的合理性がないため、**Preview.svelteと同じ`BlockerList`をそのまま編集可能で使う**
- Todo一覧: `TodoList.svelte`を`todos={plugin.store.getTodos(ticketPath)}`, `showParentBadge={false}`, `addTarget={ticketPath}`で使用。範囲トグルはチケットには不要(ticket配下にさらに子はいないため)

### 3.4 共通Todoリスト部品(`ui/components/TodoList.svelte`、新設)

**判断: 切り出す。**

根拠:
1. Preview.svelte(既存)のTodoセクション(チェックボックス/`TitleCell`インライン編集/`PriorityCell`/`DateCell`/昇格ボタン/削除ボタン/完了済み表示/「+ Todoを追加」フォーム、Preview.svelte:280-334の約55行)と、プロジェクト詳細・チケット詳細の2つの新設画面のTodoセクションは、**書き込み経路も表示構成も完全に同一**(`TodoService.toggle/updateInline/remove/addToSection`をそのまま使う)
2. 3箇所で同じ約55行を複製するのは、design-ui-first.md自身が確立した「セル単位の共通コンポーネント化」の思想(§3.1: 「一覧のインラインセルと詳細パネルのフィールド編集で同じ操作が出てくる、という重複をUIコンポーネントレベルでも解消する」)と地続きであり、切り出さない理由がない
3. 唯一の差分は「所属Ticketバッジの有無」(プロジェクト詳細の`all`スコープのみ)と「追加先path」であり、いずれもprop化で吸収できる

```typescript
// ui/components/TodoList.svelte (骨格)
let {
  plugin,
  todos,
  showDone,
  showParentBadge = false,
  addTarget,       // 指定時のみ「+ Todoを追加」フォームを表示。追加先pathとして使う
  onParentClick,   // showParentBadge時のバッジクリック(ticket-detailへの遷移)
}: {
  plugin: PersonalOSPlugin;
  todos: Todo[];
  showDone: boolean;
  showParentBadge?: boolean;
  addTarget?: string;
  onParentClick?: (path: string) => void;
} = $props();

const visibleTodos = $derived(showDone ? todos : todos.filter((t) => !t.done));

// commitTodoText/commitTodoDue/commitTodoPriority/toggleTodo/deleteTodo/promoteTodo/submitAddTodo は
// Preview.svelte から移設(ロジック不変、plugin.todoService.* 呼び出しのみ)
```

- `plugin.capability.todoFeatures === false`のときの非表示+バナー表示は、**`TodoList`の外側**(呼び出し元)で判定する(Preview.svelte/ProjectDetailScreen.svelte/TicketDetailScreen.svelteそれぞれの`{#if plugin.capability.todoFeatures}`ブロック内に`TodoList`を置く、という既存Previewの構造をそのまま維持)。`TodoList`自体はcapability判定を持たない(呼び出し元の文脈で「Todoセクションが存在すること自体」を制御する方が、design-ui-first.md §5の分岐箇所表と一貫する)
- Preview.svelteは本設計のPhase N2で`TodoList`を使うよう改修する(§8)。完了済み表示トグルはPreview側では新規に用意していなかった状態(常時全件表示)だが、Todoリスト共通化に合わせて`showDone`propを追加する形になるため、**Previewにも「完了済み表示」トグルが新たに増える**(要件外の副次効果だが、機能後退ではなく整合性向上のため許容する。§9.2に軽く言及)

### 3.5 詳細ページヘッダを共通コンポーネント化しない判断

Preview.svelteのヘッダ(`TitleCell`+バッジ、19-224行の6行)は非常に小さく、プロジェクト詳細・チケット詳細のヘッダも同程度の行数にしかならない一方、**パンくずの有無**(Previewにはパンくずがない)、**Progress表示の型条件分岐**(goal除外)、**goal/projectどちらのParentCellを出すか**など、共有しても分岐だらけになる要素が多い。3箇所で20行に満たないマークアップを共通化するために汎用propsの設計・保守コストを払うのは過剰と判断し、**共通コンポーネント化はしない**。ヘッダの構成要素(TitleCell/StatusCell/PriorityCell/DateCell/ParentCell)自体はすでにセル単位で共通化済みであり、実質的な重複解消はそこで達成されている。

### 3.6 各画面の空状態・0件表示

| 画面 | 0件時の表示 |
|---|---|
| プロジェクト一覧(Goalセクション自体が0件、= Projectが1件もない) | `t("manage.emptyState")`をGoalセクション枠なしで1行表示 |
| Goalセクション内のProjectが0件(フィルタで絞り込んだ結果0件になった場合) | セクションは表示したまま`ManageTable`側の既存空状態(`manage.emptyState`)がテーブル内に出る(現行`ManageTable.svelte:81-84`のロジックをそのまま使う) |
| プロジェクト詳細のチケット一覧が0件 | 同上(`ManageTable`既存ロジック流用) |
| プロジェクト詳細/チケット詳細のTodo一覧が0件 | `TodoList`内で`preview.empty.todos`相当のメッセージ(Preview.svelte:284の文言をそのまま`TodoList`へ移設して使う) |

---

## 4. Dashboard遷移設計

### 4.1 現状からの変更点

現行の全Widget(`ActiveEntitiesWidget`/`TodayTodoWidget`/`OverdueWidget`/`ReviewNeededWidget`/`BlockedWidget`/`RecentUpdatesWidget`)は、`onOpen(path)`という単一のコールバック(`Dashboard.svelte:26-28`の`openLinkText`直呼び)をpropとして受け取り、行クリックでそれを呼ぶだけの実装になっている。これを次のように変更する:

```typescript
// Dashboard.svelte (変更)
function navigateOrOpen(path: string, modifierClick: boolean): void {
  const entity = plugin.store.get(path);
  if (!modifierClick && entity?.type === "project") {
    void plugin.openManageAt({ kind: "project-detail", path: entity.path, ...defaultProjectDetailState });
    return;
  }
  if (!modifierClick && entity?.type === "ticket") {
    void plugin.openManageAt({ kind: "ticket-detail", path: entity.path, showDoneTodos: false });
    return;
  }
  openPath(path); // goal/review/resource/inbox、または修飾クリック時は従来通りノートを開く
}
```

- 各Widgetコンポーネントの行クリックハンドラを`onOpen(path)`単体から`onNavigate(path, event)`(`event.metaKey || event.ctrlKey`を判定)に差し替える。変更対象は全Widgetファイル(`ActiveEntitiesWidget`/`TodayTodoWidget`/`OverdueWidget`/`ReviewNeededWidget`/`BlockedWidget`)。`RecentUpdatesWidget`/`ActivityLogWidget`/`ParseErrorWidget`は本設計のtype別ルーティング対象外(後述)なので変更不要
- `makeProjectDetailScreen`/`makeTicketDetailScreen`(§2.1のヘルパー)を`Dashboard.svelte`からも呼べるよう`manageNav.ts`からexportする

### 4.2 type別ルーティング表

| Widget項目の種別 | 遷移先 | 備考 |
|---|---|---|
| Project(Active Projects Widget、Overdue/Blocked/ReviewNeededの中のProject項目) | `project-detail` | |
| Ticket(Active Tickets Widget、Overdue/Blocked/ReviewNeededの中のTicket項目) | `ticket-detail` | |
| Goal(Active Goals Widget) | ノートを開く(**現状維持**) | §4.3で判断根拠を述べる |
| Todo(Today's Todo / Overdue Widgetの中のTodo項目)、`parentType === "ticket"` | `ticket-detail`(`todo.parentPath`) | |
| Todo、`parentType === "project"` | `project-detail`(`todo.parentPath`) | |
| Todo、`parentType === "inbox"` | ノートを開く(**現状維持**) | Inboxノートに詳細画面は存在しない(要件§2.5にも明記) |
| RecentUpdatesWidget内の項目(goal/project/ticket/review/resource/inbox 全種別が混在) | project/ticketはproject-detail/ticket-detail、それ以外はノートを開く | 上記ルールの合成。個別の分岐追加は不要、`navigateOrOpen`の型判定がそのまま効く |
| ActivityLogWidget(テキストのみ、リンクなし) | 対象外 | 変更なし |
| ParseErrorWidget(パースエラーノート) | ノートを開く(現状維持) | パースエラーのため`store.get()`が失敗する。detail画面には表示できない |

### 4.3 「ノートを開く」の残し方(要件§2.5で設計確定を求められている事項)

**確定案**: 各Widget行のクリックは「ナビゲーション」を主動作とし、**Cmd/Ctrl+クリックでノートを直接開く**(ブラウザの新規タブ挙動と同じ慣習)。ただしこれだけではモバイル(修飾キーが存在しない)で「ノートを開く」手段が失われるため、**各Widget行に小さな「ノートを開く」アイコンボタンを常設する**(例: `↗`や`obsidian`風のリンクアイコン、`RowMenu`のような複数項目メニューにはしない — Dashboard Widgetは元々1行の情報密度が高く、`RowMenu`相当のフルメニューを追加すると要件§4「タップ領域を十分確保」に反する高さになるため、単機能の1アイコンに留める)。

- 実装: 各Widgetの`<li>`内に`<button class="pos-widget-open-note" onclick={(e) => { e.stopPropagation(); onOpenNote(path); }} aria-label={t("dashboard.openNote")}>↗</button>`を追加。主要な行クリック領域(テキスト部分)は`onNavigate`、アイコンボタンは`onOpenNote`(=既存の`openLinkText`)を担う
- Goal項目については、そもそも`navigateOrOpen`が常にノートを開く動作になる(§4.3参照)ため、アイコンボタンは不要(行クリック自体がノートを開く。現状のまま)

**Goal Widget項目クリックの判断根拠**: 要件§1.3でGoal詳細ページは明確にスコープ外とされている。プロジェクト一覧はGoalごとにグルーピング表示されるため、「Goalの深掘り」に近い操作は一覧画面内で自然に行える(該当Goalのセクションを見ればよい)。一覧画面への「該当Goalセクションへスクロール+展開」という遷移も選択肢としてあり得るが、(a) Goal自体の詳細情報(status/progress等)を見る手段が結局ノートしかない、(b) スクロール位置の管理はプロジェクト一覧のスクロール状態という新しい保持対象を増やし複雑化する、という理由から**シンプルに「ノートを開く」を維持**する。要件へのフィードバック事項として明記する(§9.2)。

---

## 5. SavedView互換設計

### 5.1 viewMode "manage" の再定義

旧: 「タブ(project/ticket/todo)+フィルタ+ソート」の保存。新: **「プロジェクト一覧画面のフィルタ+ソート」の保存**のみを意味する(ドリルダウンモデルには保存対象になりうる画面が一覧画面しかないため。詳細画面はentity固有のpathを持つ一時的な画面であり、SavedViewの「繰り返し使うフィルタプリセット」という性質にそぐわない)。

- 保存: `plugin.savedViewService.save({ name, query: filterToQueryString(listFilter, "project"), sort: listSort, viewMode: "manage" })`。**`tab`フィールドは新規保存時に付与しない**(`undefined`のまま。型定義上はoptionalなので問題ない)
- 復元: `queryStringToFilter(view.query)`で`listFilter`を再構築、`listSort = view.sort`。`view.tab`は**読み込み時に一切参照しない**(旧データの`tab`値がどうであれ、常にproject-listへの適用として扱う)

### 5.2 旧`tab`付きSavedViewの互換動作(要件§3.2で設計確定を求められている事項)

**確定案**: SavedView選択肢(picker)には、`viewMode === "manage"`かつ`tab === "project" || tab === undefined`のもののみを表示する。`tab === "ticket"`または`tab === "todo"`で保存された旧SavedViewは、**pickerの選択肢から除外する**(データ自体は`data.json`上に残り続け、削除もマイグレーションもしない。エラーも発生しない)。

理由:
- 旧`tab:"ticket"`のSavedViewは、クエリ文字列内に`status:doing`のようなTicket用status値や`project:住宅ローン比較`のようなgoal/projectキーの使い分けを含んでいる可能性が高い。これをそのままプロジェクト一覧(Projectのstatus値・goalキー基準)に適用すると、フィルタ内容が意味的に噛み合わず「該当なし」または意図しない絞り込みになる
- 「無視して一覧に適用する」案(tabを無視してqueryだけ流用)は上記の理由で誤った結果を返しうるため採用しない。「pickerに出さない」方が**サイレントな誤動作より安全**という判断
- 実装: `plugin.savedViewService.list().filter((v) => v.viewMode === "manage" && (v.tab === "project" || v.tab === undefined))`(`Manage.svelte`の現行`manageSavedViews`算出ロジックの条件を1つ追加するだけ)

### 5.3 `filterToQueryString`/`queryStringToFilter`の流用範囲

- 両関数とも**無改造**。呼び出し側で`tab`引数に常に`"project"`を固定して渡すだけでよい(既存シグネチャ`filterToQueryString(f: ManageFilter, tab: ManageTab)`のまま)
- list/kanbanのSavedViewには影響しない(要件§3.2の通り、`viewMode !== "manage"`の分岐はSearch.svelte/Kanban.svelte側で従来通り)

---

## 6. エラー処理・機能制限モード

design-ui-first.md §5の該当部分を、タブ構成からドリルダウン構成へ合わせて改訂する。

| 分岐箇所 | 判定 | 動作 |
|---|---|---|
| プロジェクト詳細・チケット詳細のTodo一覧セクション(`TodoList`を包む`{#if}`) | `plugin.capability.todoFeatures === false` | セクション非表示+案内バナー(`manage.todoDisabledNotice`を流用) |
| プロジェクト一覧・プロジェクト詳細・チケット詳細のEntity系操作(プロパティ編集/status変更/Blocker編集/Archive/削除/新規作成/昇格) | capability無関係 | 常に動作(design-ui-first.md §5の方針を継承) |
| 解析エラーノート | `IndexStore.getParseErrors()`に含まれるpath | プロジェクト一覧/チケット一覧には出さない(`listByType`/`getChildren`が対象外のため対応不要、従来通り)。Dashboardの`ParseErrorWidget`からは「ノートを開く」のみ(§4.2) |
| ナビゲーションスタックの検証(§2.4) | `reconcileStack`の`truncated` | `Notice(t("manage.nav.entityGone"))` + スタック切り詰め |
| インライン編集の書き込み失敗 | 既存`EntityFieldService`/`TodoService`の例外 | design-ui-first.md §5の既存フロー(Notice+ロールバック)を継承、変更なし |
| SavedView旧`tab`互換 | `tab === "ticket"/"todo"` | pickerから除外(§5.2)。エラーにはしない |

- capability変化(`capability-changed`)の購読先はManageView(既存のまま)。Todoセクション非表示の切り替えは`TodoList`を包む`{#if plugin.capability.todoFeatures}`が既存の`Manage.svelte`同様リアクティブに反応する

---

## 7. パフォーマンス設計

design-ui-first.md §6を継承しつつ、画面遷移そのものについて追記する。

| 対策 | 内容 |
|---|---|
| 画面遷移 | `stack`への配列代入のみで、Svelteの`{#if screen.kind === ...}`分岐により**再マウントなし**で切り替わる(要件§4「体感遅延なし」)。データ取得は既存Widget/ManageTable同様`IndexStore`の同期メソッド(`get`/`getChildren`/`getTodos`)のみで、ファイルI/Oは発生しない |
| `reconcileStack`の実行コスト | スタック深さは最大3(project-list/project-detail/ticket-detail)であり、`index-updated`のたびに実行しても無視できるコスト。`renames`配列は同一デバウンス窓内の件数(通常1件)分のみ |
| Goalグルーピング(`groupProjectsByGoal`) | `buildManageRows`が返す配列を1回走査してMapに振り分けるのみ(既存`buildManageRows`のO(n log n)ソートに対してO(n)の追加コスト)。500件規模でも問題ない(design-ui-first.md §6の500行前提を継承) |
| `collectProjectTodos`(scope: all) | `getChildren`+各Ticketの`getTodos`のflatMapで、配下Ticket数×平均Todo数のオーダー。Project 1件あたりのTicket数は数十件規模を想定しており、Dashboard/Kanbanと同等のDOM量に収まる |
| デバウンス | `ManageView`の100msデバウンスは維持。rename payloadの蓄積(`pendingRenames`)もこの窓の中で行う(§2.4) |

---

## 8. テストケース定義

### 8.1 `manageNav.ts`(新規、Vitest対象)

| # | 対象 | 期待 |
|---|---|---|
| N-1 | `pushScreen([{kind:"project-list"}], makeProjectDetailScreen("p1"))` | 長さ2のスタックになり、末尾が`project-detail`/`path:"p1"` |
| N-2 | `popTo(stack, 0)`(3階層スタックから) | project-listのみに切り詰められる |
| N-3 | `popTo(stack, 1)` | 先頭2つが残る(project-list+project-detail) |
| N-4 | `popOne(stack)`(3階層) | 末尾1つが除去される |
| N-5 | `popTo(stack, -1)` / `popTo(stack, 99)`(範囲外) | 変化なし(元のstackをそのまま返す) |
| N-6 | `makeProjectDetailScreen`を2回呼んで得た2つのオブジェクト | 互いに独立(片方の`ticketFilter`を書き換えてももう片方に影響しない) |

### 8.2 `reconcileStack`

| # | 状況 | 期待 |
|---|---|---|
| R-1 | project-detail(path=A)表示中、Aが`store`から消滅(削除) | `stack`が`[project-list]`まで切り詰められ`truncated: true` |
| R-2 | project-list ▸ project-detail(A) ▸ ticket-detail(B)、Bが削除 | `stack`が`[project-list, project-detail(A)]`まで切り詰め(Aは無事のため残る) |
| R-3 | project-detail(A)表示中、Aが`status: "archived"`に変化 | R-1と同様に切り詰め |
| R-4 | ticket-detail(B)表示中、`renames=[["B旧パス","B新パス"]]`かつ新パスのentityが`type:"ticket"` | pathが書き換わり`truncated: false`(切り詰めなし) |
| R-5 | ticket-detail(B)表示中、Ticket→Project昇格により`renames=[["B旧パス","B新パス"]]`だが新パスentityが`type:"project"` | 型不一致のため書き換えられず、そのフレームより上が切り詰められる(`truncated: true`) |
| R-6 | renamesが空配列、全フレーム有効 | スタック不変、`truncated: false` |
| R-7 | project-list単体のスタック | 何が起きても`stack`は`[project-list]`のまま(0番目は検証対象外) |

### 8.3 `groupProjectsByGoal`

| # | 状況 | 期待 |
|---|---|---|
| G-1 | goal未設定のProjectが混在 | 「未分類」グループ(`goal: null`)が生成され、常に配列末尾になる |
| G-2 | 複数Goal、status違い(active/paused/done/archived) | active→paused→done→archivedの順でグループが並ぶ |
| G-3 | 同一statusのGoalが複数 | title昇順で並ぶ |
| G-4 | Projectの`goal`が指す先がIndexStoreに存在しない(不整合) | クラッシュせず「未分類」に含まれる |
| G-5 | フィルタ適用後0件になったGoal | そのGoalのグループ自体は残り(`projects: []`)、表示側で空状態を出す(§3.6) |

### 8.4 `collectProjectTodos`

| # | 状況 | 期待 |
|---|---|---|
| C-1 | scope: "direct" | プロジェクト直下のTodoのみ返る |
| C-2 | scope: "all"、配下Ticketが2件 | 直下+2Ticket分のTodoが結合されて返る |
| C-3 | scope: "all"、配下Ticketの1つが`status: "archived"` | archivedなTicketのTodoは含まれない |
| C-4 | 配下Ticketが0件 | scope: "all"でも直下Todoのみ(空配列との結合で例外なし) |

### 8.5 SavedView旧`tab`互換

| # | 入力 | 期待 |
|---|---|---|
| S-1 | `{ viewMode:"manage", tab:"project" }` | pickerに表示される |
| S-2 | `{ viewMode:"manage" }`(tabフィールドなし、旧旧形式) | pickerに表示される(`tab === undefined`扱い) |
| S-3 | `{ viewMode:"manage", tab:"ticket" }` | pickerから除外される(エラーは発生しない) |
| S-4 | `{ viewMode:"manage", tab:"todo" }` | 同上 |
| S-5 | `{ viewMode:"list" }` / `{ viewMode:"kanban" }` | 従来通りSearch/Kanban側のロジックに影響なし |

### 8.6 手動確認(要件§5 受け入れ基準1〜12対応)

design-ui-first.md同様、Vitest化しづらいUI遷移・モバイルタップ操作・Dashboard連携は手動確認とする。要件§5の12項目をそのままチェックリスト化し、Phase N4の成果物とする(§9)。

---

## 9. 実装フェーズ計画

依存関係を踏まえ、design-ui-first.md §8のPhase A/Bの後続として「Phase N1〜N4」を追加する。

| Phase | 内容 | 依存 | 成果物・テスト |
|---|---|---|---|
| **N1: ナビゲーション基盤+プロジェクト一覧** | `ui/manage/manageNav.ts`新設(`ManageScreen`型/`pushScreen`/`popTo`/`popOne`/`reconcileStack`)、`ManageView.ts`の`index-updated`購読をpayload対応に変更、`Manage.svelte`をスタック描画に全面差し替え(タブUI削除)、`ProjectListScreen.svelte`新設(`groupProjectsByGoal`+折りたたみ+`ManageFilterBar`/`ManageTable`/`ManageRow`流用+`onNavigate`追加)、SavedView保存/復元をproject-list専用に変更(§5) | design-ui-first.md Phase A/B全て | Vitest: §8.1/8.2/8.3。手動確認: 受け入れ基準1、9(新形式SavedView) |
| **N2: プロジェクト詳細+共通Todoリスト部品** | `ProjectDetailScreen.svelte`新設(ヘッダ/`buildProjectTicketRows`+チケット一覧/`collectProjectTodos`+範囲トグル)、`ui/components/TodoList.svelte`新設(Preview.svelteのTodoセクションから移設)、`Preview.svelte`を`TodoList`使用に改修 | N1 | Vitest: §8.4。手動確認: 受け入れ基準2、5、7(Preview含む) |
| **N3: チケット詳細+Dashboard遷移+自動巻き戻し** | `TicketDetailScreen.svelte`新設(ヘッダ+Blockers+`TodoList`)、`main.ts`に`openManageAt()`追加、`ManageView.navigateTo()`追加、`Dashboard.svelte`+各Widgetのクリックハンドラをtype別ルーティングに変更(§4)、「ノートを開く」アイコンボタン追加、`reconcileStack`をManage.svelteに配線(自動巻き戻し実装) | N2 | 手動確認: 受け入れ基準3、6、8、12(モバイルタップ含む) |
| **N4: 仕上げ** | SavedView旧`tab`互換のpicker絞り込み実装(§5.2)、capability分岐の全箇所確認(§6表)、`manageData.ts`の`tab==="todo"`分岐削除・関連未使用コード整理、i18nキー総点検(新規: `manage.nav.entityGone`/`manage.nav.unknown`/`dashboard.openNote`等)、要件§5受け入れ基準12項目の1件ずつのチェックリスト化 | N1〜N3 全て | 受け入れ基準1〜12(要件§5)を全項目チェック |

---

## 10. 補足

### 10.1 まとめ: 主要な設計判断

1. **ナビゲーション状態の持ち方**: 画面スタック(`ManageScreen[]`)をSvelte 5の`$state`で保持し、push/pop/breadcrumbジャンプは`manageNav.ts`の純粋関数で実装してVitest対象にする。project-listのフィルタ・折りたたみ状態はスタック**外**の永続state、detail画面のページ内設定はスタックフレーム**自身**が保持することで、要件§3.3の「戻れば保持/別対象なら初期化」を追加のフラグ管理なしに自然に満たす
2. **共通Todoリスト部品の切り出し**: `ui/components/TodoList.svelte`として切り出す。Preview.svelteの既存実装(約55行)と新設2画面の重複を解消し、`Preview.svelte`自身もこれに移行する
3. **Dashboard遷移方式**: 行クリック=ナビゲーション、Cmd/Ctrl+クリック or 常設の小アイコンボタン=ノートを開く。Goal項目のみ現状維持(ノートを開く)とし、Goal詳細ページを新設しない
4. **SavedView互換方式**: 旧`tab:"ticket"/"todo"`のSavedViewはpickerから除外(データは保持、エラーなし)。`viewMode:"manage"`は「プロジェクト一覧のフィルタプリセット」に意味を再定義する
5. **表示中Entity削除/Archive時の自動巻き戻し**: `index-updated`のrename payload(`[oldPath, newPath]`)を使い、型が一致するrenameはその場でpath追従(無音)、型不一致(Ticket→Project昇格等)や削除/Archiveは検出した階層から上をまとめて切り詰めてNoticeを出す

### 10.2 要件定義書へのフィードバック事項

1. **§2.5「ノートを開く」の残し方の確定**: 主要クリック=ナビゲーション、各行の常設アイコンボタン+Cmd/Ctrl+クリック=ノートを開く、という方式で確定した。モバイルでは修飾キーが使えないため、アイコンボタンが唯一の手段になる。要件書に採用方式を明記することを推奨する
2. **§2.5 Goal項目クリック時の遷移先**: Goal詳細ページがスコープ外(§1.3)であることと、プロジェクト一覧がGoalグルーピング表示であることから、Goal項目クリックは**現状維持(ノートを開く)**とした。プロジェクト一覧内の「該当Goalセクションへスクロール」は今回見送った(スクロール位置という新しい状態管理を要件のスコープに追加することになるため)。将来的に必要であれば別途要件化を推奨する
3. **§3.5 Ticket→Project昇格時のticket-detail表示中の挙動**: `PromoteService.promoteTicketToProject`は新パスを呼び出し元に返さない実装のため、「同じエンティティを追いかけて`project-detail`へ自動で切り替える」ことは現状のService APIでは実現できない。本設計では「型不一致 = 消滅」として扱い、上位階層(プロジェクト詳細 or 一覧)へ戻す挙動に統一した。要件§3.5は「削除/Archive」のみ明記しており昇格には言及がないため、この解釈(昇格も同様に「一つ上の階層へ戻る」対象とする)を要件書へ追記することを推奨する
4. **§3.3 一覧経由の再訪問と「戻る」経由の再訪問の区別**: 同じプロジェクトへ「一覧から再度クリックして入る」場合と「パンくずで戻って再度進む」場合とで、ページ内設定(Todo範囲トグル等)の扱いが異なる(前者はデフォルトに戻り、後者は保持される)という設計とした。要件§3.3の文言はこの区別まで明記していなかったため、確認・追記を推奨する
5. **§3.2 SavedView旧`tab`互換の具体案**: 「pickerから除外(データは保持、エラーにしない)」で確定した。「無視して一覧にそのまま適用」ではなく除外を選んだ理由(誤った絞り込み結果を防ぐため)を含め、要件書へ追記することを推奨する
