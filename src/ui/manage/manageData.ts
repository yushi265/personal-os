/**
 * Presentation層(ManageView専用データ整形): 統合管理Viewの一覧+フィルタ+ソート(design-ui-first.md §3.2)。
 * ManageView.ts / Manage.svelte から呼ばれる純粋関数群。Obsidian APIには依存しない。
 */
import {
	computeOrderForInsert,
	ENTITY_TYPES,
	validStatusesOf,
	type Entity,
	type EntityType,
	type OrderableRow,
	type Priority,
} from "../../domain/entity";
import type { Todo } from "../../domain/todo";
import type { IndexStore } from "../../infra/IndexStore";
import { evaluate, parseQuery, type ParsedQuery, type Period } from "../../domain/query";

/**
 * buildManageRows/groupProjectsByGoal等が実際に参照するのは`store`のみ(Obsidian API非依存)。
 * PersonalOSPlugin本体を型注釈に使うとテスト・サーバー側(ApiRouter、design-browser-ui.md §8)で
 * フルインスタンスの用意が必要になるため、必要最小限のこのインターフェースを受け取る形にする。
 * 実際のプラグインインスタンスは構造的にこれを満たすため、既存呼び出し箇所は無変更で動く。
 */
export interface ManageDataPlugin {
	store: IndexStore;
}

export type ManageTab = "project" | "ticket";

export interface ManageFilter {
	keyword: string;
	statuses: string[]; // 複数選択(空配列=全件)
	priorities: string[];
	parentPath?: string; // goal(projectタブ) or project(ticketタブ)
	period?: Period;
	tags: string[];
	labels: string[];
	/** ドリルダウン化(design-drilldown-nav.md §1.2)でTodoタブ自体が廃止されたため現状未使用。SavedView.query往復の型対称性のため残置 */
	showDone: boolean;
	showArchived: boolean;
}

export const EMPTY_MANAGE_FILTER: ManageFilter = {
	keyword: "",
	statuses: [],
	priorities: [],
	parentPath: undefined,
	period: undefined,
	tags: [],
	labels: [],
	showDone: false,
	showArchived: false,
};

/**
 * §3.2の型ではキーを "due" | "priority" | "title" | "progress" としているが、
 * 旧Todoタブ(design-drilldown-nav.md §1.2で廃止済み)は text(タイトル相当)/所属という別軸を持っていたため
 * "text" / "parent" が追加されている。UI上ではもう使われないが、SavedView.sort(settings.ts)の型が
 * このunionをそのまま参照しており、旧data.json由来の値を読んでも型エラーにならないよう残置する。
 */
export type ManageSortKey = "due" | "priority" | "title" | "progress" | "status" | "text" | "parent" | "manual";

export interface ManageSort {
	key: ManageSortKey;
	order: "asc" | "desc";
}

export const DEFAULT_ENTITY_SORT: ManageSort = { key: "manual", order: "asc" };

export interface ManageRowData {
	kind: "entity";
	entity: Entity;
	/** 表示用に解決済みの親(goal/project、tab依存)title */
	parentTitle?: string;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function priorityRank(p?: Priority): number {
	return p ? (PRIORITY_RANK[p] ?? 3) : 3;
}

/** ワークフロー順(PROJECT_STATUSES/TICKET_STATUSESの並び)でのstatusの位置。未知typeやstatusは末尾扱い */
function statusRank(e: Entity): number {
	const order = validStatusesOf(e.type);
	if (!order) return Number.MAX_SAFE_INTEGER;
	const idx = order.indexOf(e.status);
	return idx >= 0 ? idx : order.length;
}

function splitCsv(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
}

/** ManageFilter → domain/query.ts の ParsedQuery へのマッピング(§3.2.1)。goal/project判定にtabを要する(設計スケルトンからの逸脱、報告参照) */
export function filterToQuery(f: ManageFilter, tab: ManageTab): ParsedQuery {
	const filters: Record<string, string> = {};
	if (f.statuses.length > 0) filters.status = f.statuses.join(",");
	if (f.priorities.length > 0) filters.priority = f.priorities.join(",");
	if (f.tags.length > 0) filters.tags = f.tags.join(",");
	if (f.labels.length > 0) filters.labels = f.labels.join(",");
	if (f.period) filters.period = f.period;
	if (f.parentPath) {
		const key = tab === "project" ? "goal" : "project";
		filters[key] = f.parentPath;
	}
	return { filters, text: f.keyword.trim() };
}

/** ManageFilter → クエリ文字列(SavedView.query保存用、§3.2.1) */
export function filterToQueryString(f: ManageFilter, tab: ManageTab): string {
	const q = filterToQuery(f, tab);
	const tokens = Object.entries(q.filters).map(([k, v]) => `${k}:${v}`);
	if (q.text) tokens.push(q.text);
	return tokens.join(" ");
}

/** クエリ文字列 → ManageFilter(parseQuery()の逆変換+デフォルト補完)。showDone/showArchivedはクエリに含まれないためデフォルト値を補う */
export function queryStringToFilter(s: string): ManageFilter {
	const q = parseQuery(s);
	return {
		keyword: q.text,
		statuses: splitCsv(q.filters.status),
		priorities: splitCsv(q.filters.priority),
		parentPath: q.filters.goal ?? q.filters.project,
		period: (q.filters.period as Period | undefined) ?? undefined,
		tags: splitCsv(q.filters.tags),
		labels: splitCsv(q.filters.labels),
		showDone: false,
		showArchived: false,
	};
}

function compareWithTieBreak(cmp: number, order: "asc" | "desc", tieBreak: () => number): number {
	if (cmp !== 0) return order === "asc" ? cmp : -cmp;
	return tieBreak();
}

/** Entity一覧のソート。デフォルト優先順(priority→due→title)はkanbanData.sortEntitiesと揃える(可能な範囲で同ロジックを再利用) */
export function sortEntityRows(entities: Entity[], sort: ManageSort): Entity[] {
	const tieBreak = (a: Entity, b: Entity): number => {
		const pr = priorityRank(a.priority) - priorityRank(b.priority);
		if (pr !== 0) return pr;
		const ad = a.due ?? "9999-99-99";
		const bd = b.due ?? "9999-99-99";
		if (ad !== bd) return ad < bd ? -1 : 1;
		return a.title.localeCompare(b.title);
	};

	return [...entities].sort((a, b) => {
		let cmp = 0;
		switch (sort.key) {
			case "due":
				cmp = (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99");
				break;
			case "priority":
				cmp = priorityRank(a.priority) - priorityRank(b.priority);
				break;
			case "progress":
				cmp = (a.progress ?? 0) - (b.progress ?? 0);
				break;
			case "status":
				cmp = statusRank(a) - statusRank(b);
				break;
			case "manual": {
				if (a.order !== undefined && b.order !== undefined) cmp = a.order - b.order;
				else if (a.order !== undefined) cmp = -1;
				else if (b.order !== undefined) cmp = 1;
				else cmp = 0; // 両者ともorder未設定ならtieBreak(priority→due→title)へ委ねる
				break;
			}
			case "title":
			default:
				cmp = a.title.localeCompare(b.title);
				break;
		}
		if (sort.key === "manual") {
			// manualは方向概念を持たない(常に昇順)。両者orderありでcmp!==0ならそのまま、無ければtieBreak
			return cmp !== 0 ? cmp : tieBreak(a, b);
		}
		return compareWithTieBreak(cmp, sort.order, () => tieBreak(a, b));
	});
}

/**
 * Goal跨ぎドロップ(design-reorder-and-notes.md A-4)用: ドロップ先のGoalセクションにまだ属していない
 * エンティティが targetIndex/position の位置に入るとしたら、どのorder値を採るべきかを計算する。
 * targetRowsは現在のプロパティ(entity.order)を含むドロップ先セクションの表示行。
 */
export function computeCrossGroupOrder(targetRows: OrderableRow[], targetIndex: number, position: "before" | "after"): number {
	const idx = position === "after" ? targetIndex + 1 : targetIndex;
	const rows2 = targetRows.slice();
	const insertAt = Math.max(0, Math.min(idx, rows2.length));
	const placeholder: OrderableRow = { path: "__incoming__" };
	rows2.splice(insertAt, 0, placeholder);
	const changes = computeOrderForInsert(rows2, insertAt, insertAt);
	const match = changes.find((c) => c.path === "__incoming__");
	return match ? match.order : 100;
}

/** entityのgoal/project(tabに応じてどちらか一方)のtitleを解決する */
function resolveEntityParentTitle(plugin: ManageDataPlugin, tab: ManageTab, entity: Entity): string | undefined {
	const parentPath = tab === "project" ? entity.goal : entity.project;
	if (!parentPath) return undefined;
	return plugin.store.get(parentPath)?.title ?? parentPath;
}

/** タブ・フィルタ・ソートに応じた表示行を構築する(index-updated契機の再描画から呼ばれる想定) */
export function buildManageRows(plugin: ManageDataPlugin, tab: ManageTab, filter: ManageFilter, sort: ManageSort): ManageRowData[] {
	const type: EntityType = tab;
	let entities = plugin.store.listByType(type);
	if (!filter.showArchived) entities = entities.filter((e) => e.status !== "archived");
	const q = filterToQuery(filter, tab);
	entities = entities.filter((e) => evaluate(q, e, (p) => plugin.store.get(p)?.title));
	return sortEntityRows(entities, sort).map((entity) => ({
		kind: "entity",
		entity,
		parentTitle: resolveEntityParentTitle(plugin, tab, entity),
	}));
}

export interface GoalGroup {
	goal: Entity | null; // null = 未分類
	projects: Entity[];
}

const GOAL_STATUS_RANK: Record<string, number> = { active: 0, paused: 1, done: 2, archived: 3 };

function goalKeyOf(plugin: ManageDataPlugin, project: Entity): string | null {
	return project.goal && plugin.store.get(project.goal) ? project.goal : null;
}

/**
 * Goalごとにグルーピングする(design-drilldown-nav.md §3.1)。goalのstatus順(active→paused→done→archived)→title順、
 * 未分類(goal未設定 or 参照先がIndexStoreに存在しない不整合データ)は末尾固定。
 *
 * Goalセクション自体の有無は「archived除外」(構造的な絞り込み)のみで決め、キーワード/status/priority/tags/period
 * といった内容フィルタで0件になっても、そのGoalセクションは`projects: []`のまま残す(§3.6・§8.3 G-5)。
 */
export function groupProjectsByGoal(plugin: ManageDataPlugin, filter: ManageFilter, sort: ManageSort): GoalGroup[] {
	let allProjects = plugin.store.listByType("project");
	if (!filter.showArchived) allProjects = allProjects.filter((e) => e.status !== "archived");

	const byGoal = new Map<string | null, Entity[]>();
	for (const project of allProjects) {
		const key = goalKeyOf(plugin, project);
		if (!byGoal.has(key)) byGoal.set(key, []);
	}

	const rows = buildManageRows(plugin, "project", filter, sort); // 既存関数をtab固定で流用(内容フィルタ+ソート)
	for (const row of rows) {
		const key = goalKeyOf(plugin, row.entity!);
		byGoal.get(key)!.push(row.entity!);
	}

	const goalRank = (g: Entity | null) => (g ? (GOAL_STATUS_RANK[g.status] ?? 99) : 100);
	const groups: GoalGroup[] = Array.from(byGoal.entries()).map(([path, projects]) => ({
		goal: path ? (plugin.store.get(path) ?? null) : null,
		projects,
	}));
	return groups.sort((a, b) => {
		const r = goalRank(a.goal) - goalRank(b.goal);
		return r !== 0 ? r : (a.goal?.title ?? "￿").localeCompare(b.goal?.title ?? "￿");
	});
}

/**
 * プロジェクト詳細画面のチケット一覧(design-drilldown-nav.md §3.2)。
 * 全チケットを走査してから絞るのではなく、getChildren(projectPath)を起点にそのプロジェクトの子のみを対象にする。
 */
export function buildProjectTicketRows(
	plugin: ManageDataPlugin,
	projectPath: string,
	filter: ManageFilter,
	sort: ManageSort
): ManageRowData[] {
	let tickets = plugin.store.getChildren(projectPath).filter((e) => e.type === "ticket");
	if (!filter.showArchived) tickets = tickets.filter((e) => e.status !== "archived");
	const q = filterToQuery(filter, "ticket");
	tickets = tickets.filter((e) => evaluate(q, e, (p) => plugin.store.get(p)?.title));
	return sortEntityRows(tickets, sort).map((entity) => ({ kind: "entity", entity }));
}

/**
 * Goal詳細画面の配下プロジェクト一覧(buildProjectTicketRowsのgoal版)。
 * 全プロジェクトを走査してから絞るのではなく、getChildren(goalPath)を起点にそのgoalの子のみを対象にする。
 */
export function buildGoalProjectRows(
	plugin: ManageDataPlugin,
	goalPath: string,
	filter: ManageFilter,
	sort: ManageSort
): ManageRowData[] {
	let projects = plugin.store.getChildren(goalPath).filter((e) => e.type === "project");
	if (!filter.showArchived) projects = projects.filter((e) => e.status !== "archived");
	const q = filterToQuery(filter, "project");
	projects = projects.filter((e) => evaluate(q, e, (p) => plugin.store.get(p)?.title));
	return sortEntityRows(projects, sort).map((entity) => ({ kind: "entity", entity }));
}

/**
 * プロジェクト詳細画面のTodo一覧(design-drilldown-nav.md §3.2)。
 * direct: プロジェクト直下のTodoのみ。all: 直下+配下の非archivedチケット全ての未完了Todoを集約する。
 */
export function collectProjectTodos(store: IndexStore, projectPath: string, scope: "direct" | "all"): Todo[] {
	const direct = store.getTodos(projectPath);
	if (scope === "direct") return direct;
	const ticketTodos = store
		.getChildren(projectPath)
		.filter((e) => e.type === "ticket" && e.status !== "archived")
		.flatMap((ticket) => store.getTodos(ticket.path));
	return [...direct, ...ticketTodos];
}

/** Preview(§4.6)からも使うため、フィルタ候補集計ヘルパーをここに置く */
export function collectKnownTags(store: IndexStore): string[] {
	const set = new Set<string>();
	for (const type of ENTITY_TYPES) {
		for (const e of store.listByType(type)) e.tags.forEach((tag) => set.add(tag));
	}
	return Array.from(set).sort();
}

export interface ProgressFraction {
	done: number;
	total: number;
}

/** Ticketの進捗分数(完了Todo数/総数)。ManageRow等の「%」表示に添える(design: 進捗の分数表示) */
export function ticketTodoFraction(store: IndexStore, ticketPath: string): ProgressFraction {
	const todos = store.getTodos(ticketPath);
	return { done: todos.filter((t) => t.done).length, total: todos.length };
}

/** Projectの進捗分数: 配下の非archivedチケットの全Todo + 直下Todoを合算する(calcProjectProgressの集計対象と揃える) */
export function projectTodoFraction(store: IndexStore, projectPath: string): ProgressFraction {
	const direct = store.getTodos(projectPath);
	const ticketTodos = store
		.getChildren(projectPath)
		.filter((e) => e.type === "ticket" && e.status !== "archived")
		.flatMap((ticket) => store.getTodos(ticket.path));
	const all = [...direct, ...ticketTodos];
	return { done: all.filter((t) => t.done).length, total: all.length };
}

/** entity.typeに応じてticketTodoFraction/projectTodoFractionのどちらかを返す(ManageRow/詳細ヘッダ共通) */
export function entityProgressFraction(store: IndexStore, entity: Entity): ProgressFraction {
	return entity.type === "project" ? projectTodoFraction(store, entity.path) : ticketTodoFraction(store, entity.path);
}

/**
 * Goalヘッダの配下Project集計進捗(design: Goalセクションの集計進捗)。
 * 0件ならnull(非表示)。projects側で既にarchived除外済みであることを前提とする(groupProjectsByGoal参照)。
 */
export function goalGroupProgress(projects: Entity[]): number | null {
	if (projects.length === 0) return null;
	const sum = projects.reduce((acc, p) => acc + (p.progress ?? 0), 0);
	return Math.round(sum / projects.length);
}

/** インライン新規作成行(InlineCreateRow.svelte)のタイトルバリデーション。空白のみは不可(design-ui-first.md §4.2 titleRequiredと同方針) */
export function isValidInlineTitle(title: string): boolean {
	return title.trim().length > 0;
}

/** GoalGroupの識別key(goal未設定=未分類はこの固定文字列)。ProjectListScreen.svelteのgroupKey()と揃える */
function goalGroupKey(goal: Entity | null): string {
	return goal?.path ?? "__unclassified__";
}

/**
 * 「n」キーでのインライン新規作成フォーカス先(Phase U2→U3改善、design追補)。
 * 先頭固定ではなく、展開中(折りたたまれていない)最初のGoalセクションのindexを返す。
 * 全セクションが折りたたみ中の場合は先頭(0)にフォールバックする。
 */
export function firstExpandedGroupIndex(groups: GoalGroup[], collapsedGoals: Set<string>): number {
	const idx = groups.findIndex((g) => !collapsedGoals.has(goalGroupKey(g.goal)));
	return idx >= 0 ? idx : 0;
}

/**
 * オンボーディング判定(design-drilldown-nav.md追補、Phase U3): Vault内にGoal/Projectが1件も無いかどうか。
 * archivedを含む全件で判定する(フィルタ結果ではなくVaultそのものの状態を見るため)。
 * 管理View(ProjectListScreen)・Dashboardの両方の空ウェルカム画面表示判定から共通で使う。
 */
export function isManageVaultEmpty(store: IndexStore): boolean {
	return store.listByType("goal").length === 0 && store.listByType("project").length === 0;
}

/** Entityのlabelsに加え、Todoのlabelsも集計対象に含める(Todoタブのlabelsフィルタ候補のため) */
export function collectKnownLabels(store: IndexStore): string[] {
	const set = new Set<string>();
	for (const type of ENTITY_TYPES) {
		for (const e of store.listByType(type)) e.labels.forEach((label) => set.add(label));
	}
	for (const todo of store.getAllTodos()) todo.labels.forEach((label) => set.add(label));
	return Array.from(set).sort();
}
