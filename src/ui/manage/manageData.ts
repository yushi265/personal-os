/**
 * Presentation層(ManageView専用データ整形): 統合管理Viewの一覧+フィルタ+ソート(design-ui-first.md §3.2)。
 * ManageView.ts / Manage.svelte から呼ばれる純粋関数群。Obsidian APIには依存しない。
 */
import { ENTITY_TYPES, type Entity, type EntityType, type Priority } from "../../domain/entity";
import type { Todo } from "../../domain/todo";
import type { IndexStore } from "../../infra/IndexStore";
import { evaluate, evaluateTodo, parseQuery, type ParsedQuery, type Period } from "../../domain/query";
import type PersonalOSPlugin from "../../main";

export type ManageTab = "project" | "ticket" | "todo";

export interface ManageFilter {
	keyword: string;
	statuses: string[]; // 複数選択(空配列=全件)
	priorities: string[];
	parentPath?: string; // goal(projectタブ) or project(ticketタブ)
	period?: Period;
	tags: string[];
	labels: string[];
	showDone: boolean; // Todoタブのみ有効
	showArchived: boolean; // Projects/Ticketsタブのみ有効
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
 * Todoタブは text(タイトル相当)/所属という別軸を持つため "text" / "parent" を追加している(設計からの逸脱、報告参照)。
 */
export type ManageSortKey = "due" | "priority" | "title" | "progress" | "text" | "parent";

export interface ManageSort {
	key: ManageSortKey;
	order: "asc" | "desc";
}

export const DEFAULT_ENTITY_SORT: ManageSort = { key: "priority", order: "asc" };
export const DEFAULT_TODO_SORT: ManageSort = { key: "priority", order: "asc" };

export interface ManageRowData {
	kind: "entity" | "todo";
	entity?: Entity;
	todo?: Todo;
	/** 表示用に解決済みの親title。todoは所属先(ticket/project/inbox)のtitle、entityはgoal/project(tab依存)のtitle */
	parentTitle?: string;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function priorityRank(p?: Priority): number {
	return p ? (PRIORITY_RANK[p] ?? 3) : 3;
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
	if (f.parentPath && tab !== "todo") {
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
			case "title":
			default:
				cmp = a.title.localeCompare(b.title);
				break;
		}
		return compareWithTieBreak(cmp, sort.order, () => tieBreak(a, b));
	});
}

/** Todo一覧のソート。「所属」は親EntityのtitleをIndexStoreから解決する */
export function sortTodoRows(todos: Todo[], sort: ManageSort, store: IndexStore): Todo[] {
	const parentTitle = (todo: Todo): string => store.get(todo.parentPath)?.title ?? todo.parentPath;

	const tieBreak = (a: Todo, b: Todo): number => {
		const pr = priorityRank(a.priority) - priorityRank(b.priority);
		if (pr !== 0) return pr;
		const ad = a.dueDate ?? "9999-99-99";
		const bd = b.dueDate ?? "9999-99-99";
		if (ad !== bd) return ad < bd ? -1 : 1;
		return a.text.localeCompare(b.text);
	};

	return [...todos].sort((a, b) => {
		let cmp = 0;
		switch (sort.key) {
			case "due":
				cmp = (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
				break;
			case "priority":
				cmp = priorityRank(a.priority) - priorityRank(b.priority);
				break;
			case "parent":
				cmp = parentTitle(a).localeCompare(parentTitle(b));
				break;
			case "text":
			case "title":
			default:
				cmp = a.text.localeCompare(b.text);
				break;
		}
		return compareWithTieBreak(cmp, sort.order, () => tieBreak(a, b));
	});
}

/** todoの所属先(ticket/project/inbox)のtitleを解決する(所属列表示用) */
function resolveTodoParentTitle(plugin: PersonalOSPlugin, todo: Todo): string {
	return plugin.store.get(todo.parentPath)?.title ?? todo.parentPath;
}

/** entityのgoal/project(tabに応じてどちらか一方)のtitleを解決する */
function resolveEntityParentTitle(plugin: PersonalOSPlugin, tab: ManageTab, entity: Entity): string | undefined {
	const parentPath = tab === "project" ? entity.goal : entity.project;
	if (!parentPath) return undefined;
	return plugin.store.get(parentPath)?.title ?? parentPath;
}

/** タブ・フィルタ・ソートに応じた表示行を構築する(index-updated契機の再描画から呼ばれる想定) */
export function buildManageRows(plugin: PersonalOSPlugin, tab: ManageTab, filter: ManageFilter, sort: ManageSort): ManageRowData[] {
	if (tab === "todo") {
		let todos = plugin.store.getAllTodos();
		if (!filter.showDone) todos = todos.filter((t) => !t.done);
		const q = filterToQuery(filter, tab);
		todos = todos.filter((t) => evaluateTodo(q, t));
		return sortTodoRows(todos, sort, plugin.store).map((todo) => ({
			kind: "todo",
			todo,
			parentTitle: resolveTodoParentTitle(plugin, todo),
		}));
	}

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

function goalKeyOf(plugin: PersonalOSPlugin, project: Entity): string | null {
	return project.goal && plugin.store.get(project.goal) ? project.goal : null;
}

/**
 * Goalごとにグルーピングする(design-drilldown-nav.md §3.1)。goalのstatus順(active→paused→done→archived)→title順、
 * 未分類(goal未設定 or 参照先がIndexStoreに存在しない不整合データ)は末尾固定。
 *
 * Goalセクション自体の有無は「archived除外」(構造的な絞り込み)のみで決め、キーワード/status/priority/tags/period
 * といった内容フィルタで0件になっても、そのGoalセクションは`projects: []`のまま残す(§3.6・§8.3 G-5)。
 */
export function groupProjectsByGoal(plugin: PersonalOSPlugin, filter: ManageFilter, sort: ManageSort): GoalGroup[] {
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
	plugin: PersonalOSPlugin,
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

/** Entityのlabelsに加え、Todoのlabelsも集計対象に含める(Todoタブのlabelsフィルタ候補のため) */
export function collectKnownLabels(store: IndexStore): string[] {
	const set = new Set<string>();
	for (const type of ENTITY_TYPES) {
		for (const e of store.listByType(type)) e.labels.forEach((label) => set.add(label));
	}
	for (const todo of store.getAllTodos()) todo.labels.forEach((label) => set.add(label));
	return Array.from(set).sort();
}
