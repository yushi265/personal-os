import { describe, expect, it } from "vitest";
import { IndexStore } from "../../src/infra/IndexStore";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";
import type PersonalOSPlugin from "../../src/main";
import {
	buildManageRows,
	buildProjectTicketRows,
	collectKnownLabels,
	collectKnownTags,
	collectProjectTodos,
	DEFAULT_ENTITY_SORT,
	EMPTY_MANAGE_FILTER,
	filterToQueryString,
	groupProjectsByGoal,
	queryStringToFilter,
	sortEntityRows,
	sortTodoRows,
	type ManageFilter,
} from "../../src/ui/manage/manageData";

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Tickets/ticket-a.md",
		type: "ticket",
		title: "ticket-a",
		status: "doing",
		tags: [],
		labels: [],
		blockers: [],
		extra: {},
		...overrides,
	};
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		filePath: "PersonalOS/Tickets/ticket-a.md",
		line: 0,
		text: "do it",
		done: false,
		labels: [],
		parentType: "ticket",
		parentPath: "PersonalOS/Tickets/ticket-a.md",
		...overrides,
	};
}

function makePlugin(store: IndexStore): PersonalOSPlugin {
	return { store } as unknown as PersonalOSPlugin;
}

describe("buildManageRows", () => {
	it("returns only entities of the requested tab type, excluding archived by default", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", type: "project", title: "a", status: "active" }));
		store.upsertEntity(makeEntity({ path: "b.md", type: "project", title: "b", status: "archived" }));
		store.upsertEntity(makeEntity({ path: "c.md", type: "ticket", title: "c", status: "doing" }));
		const plugin = makePlugin(store);

		const rows = buildManageRows(plugin, "project", { ...EMPTY_MANAGE_FILTER }, { key: "title", order: "asc" });

		expect(rows.map((r) => r.entity?.title)).toEqual(["a"]);
	});

	it("includes archived entities when showArchived is true", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", type: "project", title: "a", status: "active" }));
		store.upsertEntity(makeEntity({ path: "b.md", type: "project", title: "b", status: "archived" }));
		const plugin = makePlugin(store);

		const rows = buildManageRows(
			plugin,
			"project",
			{ ...EMPTY_MANAGE_FILTER, showArchived: true },
			{ key: "title", order: "asc" }
		);

		expect(rows.map((r) => r.entity?.title)).toEqual(["a", "b"]);
	});

	it("filters entities by status/priority/tags/labels/parentPath", () => {
		const store = new IndexStore();
		const goal = makeEntity({ path: "goal.md", type: "goal", title: "goal-a", status: "active" });
		store.upsertEntity(goal);
		store.upsertEntity(
			makeEntity({
				path: "p1.md",
				type: "project",
				title: "p1",
				status: "active",
				priority: "high",
				tags: ["work"],
				labels: ["urgent"],
				goal: goal.path,
			})
		);
		store.upsertEntity(
			makeEntity({ path: "p2.md", type: "project", title: "p2", status: "backlog", priority: "low", tags: ["personal"] })
		);
		const plugin = makePlugin(store);

		const rows = buildManageRows(
			plugin,
			"project",
			{ ...EMPTY_MANAGE_FILTER, statuses: ["active"], priorities: ["high"], tags: ["work"], labels: ["urgent"], parentPath: goal.path },
			{ key: "title", order: "asc" }
		);

		expect(rows.map((r) => r.entity?.title)).toEqual(["p1"]);
		expect(rows[0].parentTitle).toBe("goal-a");
	});

	it("filters entities by keyword (title substring match)", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", type: "project", title: "銀行手続き", status: "active" }));
		store.upsertEntity(makeEntity({ path: "b.md", type: "project", title: "旅行計画", status: "active" }));
		const plugin = makePlugin(store);

		const rows = buildManageRows(plugin, "project", { ...EMPTY_MANAGE_FILTER, keyword: "銀行" }, { key: "title", order: "asc" });

		expect(rows.map((r) => r.entity?.title)).toEqual(["銀行手続き"]);
	});

	it("returns undone todos by default and includes done todos when showDone is true", () => {
		const store = new IndexStore();
		store.setTodos("t.md", [makeTodo({ filePath: "t.md", parentPath: "t.md", text: "open" }), makeTodo({ filePath: "t.md", parentPath: "t.md", text: "closed", done: true })]);
		const plugin = makePlugin(store);

		const undoneOnly = buildManageRows(plugin, "todo", { ...EMPTY_MANAGE_FILTER }, { key: "text", order: "asc" });
		expect(undoneOnly.map((r) => r.todo?.text)).toEqual(["open"]);

		const withDone = buildManageRows(plugin, "todo", { ...EMPTY_MANAGE_FILTER, showDone: true }, { key: "text", order: "asc" });
		expect(withDone.map((r) => r.todo?.text).sort()).toEqual(["closed", "open"]);
	});

	it("resolves parentTitle for todo rows via IndexStore", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "t.md", type: "ticket", title: "my-ticket" }));
		store.setTodos("t.md", [makeTodo({ filePath: "t.md", parentPath: "t.md", text: "do it" })]);
		const plugin = makePlugin(store);

		const rows = buildManageRows(plugin, "todo", { ...EMPTY_MANAGE_FILTER }, { key: "text", order: "asc" });

		expect(rows[0].parentTitle).toBe("my-ticket");
	});

	it("applies period:overdue filter consistently for entities and todos", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "overdue-proj", status: "active", due: "2020-01-01" }));
		store.upsertEntity(makeEntity({ path: "p2.md", type: "project", title: "future-proj", status: "active", due: "2999-01-01" }));
		const plugin = makePlugin(store);

		const rows = buildManageRows(plugin, "project", { ...EMPTY_MANAGE_FILTER, period: "overdue" }, { key: "title", order: "asc" });

		expect(rows.map((r) => r.entity?.title)).toEqual(["overdue-proj"]);
	});
});

describe("sortEntityRows / sortTodoRows", () => {
	it("sorts entities by due ascending, falling back to priority/title tie-break", () => {
		const a = makeEntity({ path: "a.md", title: "a", due: "2026-07-10" });
		const b = makeEntity({ path: "b.md", title: "b", due: "2026-07-01" });
		const c = makeEntity({ path: "c.md", title: "c" });

		const sorted = sortEntityRows([a, b, c], { key: "due", order: "asc" });

		expect(sorted.map((e) => e.title)).toEqual(["b", "a", "c"]);
	});

	it("reverses order when order is desc", () => {
		const a = makeEntity({ path: "a.md", title: "a" });
		const b = makeEntity({ path: "b.md", title: "b" });

		const sorted = sortEntityRows([a, b], { key: "title", order: "desc" });

		expect(sorted.map((e) => e.title)).toEqual(["b", "a"]);
	});

	it("sorts todos by 所属(parent title) using IndexStore lookup", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "z.md", type: "ticket", title: "z-ticket" }));
		store.upsertEntity(makeEntity({ path: "a.md", type: "ticket", title: "a-ticket" }));
		const t1 = makeTodo({ filePath: "z.md", parentPath: "z.md", text: "one" });
		const t2 = makeTodo({ filePath: "a.md", parentPath: "a.md", text: "two" });

		const sorted = sortTodoRows([t1, t2], { key: "parent", order: "asc" }, store);

		expect(sorted.map((t) => t.text)).toEqual(["two", "one"]);
	});
});

describe("filterToQueryString / queryStringToFilter round trip", () => {
	it("round-trips a filter with multiple fields for the project tab", () => {
		const filter: ManageFilter = {
			keyword: "銀行",
			statuses: ["active", "waiting"],
			priorities: ["high"],
			parentPath: "PersonalOS/Goals/goal-a.md",
			period: "week",
			tags: ["work", "personal"],
			labels: ["urgent"],
			showDone: false,
			showArchived: false,
		};

		const s = filterToQueryString(filter, "project");
		const restored = queryStringToFilter(s);

		expect(restored.keyword).toBe("銀行");
		expect(restored.statuses.sort()).toEqual(["active", "waiting"]);
		expect(restored.priorities).toEqual(["high"]);
		expect(restored.parentPath).toBe("PersonalOS/Goals/goal-a.md");
		expect(restored.period).toBe("week");
		expect(restored.tags.sort()).toEqual(["personal", "work"]);
		expect(restored.labels).toEqual(["urgent"]);
		// showDone/showArchived are UI-only flags and are not persisted in the query string (design §3.2.1)
		expect(restored.showDone).toBe(false);
		expect(restored.showArchived).toBe(false);
	});

	it("emits project: (not goal:) for the ticket tab's parentPath", () => {
		const filter: ManageFilter = { ...EMPTY_MANAGE_FILTER, parentPath: "PersonalOS/Projects/proj-a.md" };

		const s = filterToQueryString(filter, "ticket");

		expect(s).toContain("project:PersonalOS/Projects/proj-a.md");
	});

	it("does not emit goal:/project: tokens for the todo tab", () => {
		const filter: ManageFilter = { ...EMPTY_MANAGE_FILTER, parentPath: "irrelevant-for-todo" };

		const s = filterToQueryString(filter, "todo");

		expect(s).not.toContain("goal:");
		expect(s).not.toContain("project:");
	});

	it("round-trips an empty filter to an empty query string", () => {
		const s = filterToQueryString({ ...EMPTY_MANAGE_FILTER }, "project");
		expect(s).toBe("");

		const restored = queryStringToFilter(s);
		expect(restored.keyword).toBe("");
		expect(restored.statuses).toEqual([]);
		expect(restored.parentPath).toBeUndefined();
	});
});

describe("collectKnownTags / collectKnownLabels", () => {
	it("collects unique, sorted tags across all entity types", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", type: "project", tags: ["work", "beta"] }));
		store.upsertEntity(makeEntity({ path: "b.md", type: "ticket", tags: ["work", "alpha"] }));

		expect(collectKnownTags(store)).toEqual(["alpha", "beta", "work"]);
	});

	it("collects labels from both entities and todos", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", type: "project", labels: ["entity-label"] }));
		store.setTodos("a.md", [makeTodo({ filePath: "a.md", parentPath: "a.md", labels: ["todo-label"] })]);

		expect(collectKnownLabels(store)).toEqual(["entity-label", "todo-label"]);
	});
});

describe("groupProjectsByGoal (design-drilldown-nav.md §8.3)", () => {
	it("G-1: projects without a goal form a trailing '未分類' group", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "goal-a.md", type: "goal", title: "Goal A", status: "active" }));
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1", goal: "goal-a.md" }));
		store.upsertEntity(makeEntity({ path: "p2.md", type: "project", title: "p2", goal: undefined }));
		const plugin = makePlugin(store);

		const groups = groupProjectsByGoal(plugin, { ...EMPTY_MANAGE_FILTER }, DEFAULT_ENTITY_SORT);

		expect(groups).toHaveLength(2);
		expect(groups[groups.length - 1].goal).toBeNull();
		expect(groups[groups.length - 1].projects.map((p) => p.title)).toEqual(["p2"]);
	});

	it("G-2: goal groups are ordered active -> paused -> done -> archived", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "g-done.md", type: "goal", title: "Done Goal", status: "done" }));
		store.upsertEntity(makeEntity({ path: "g-active.md", type: "goal", title: "Active Goal", status: "active" }));
		store.upsertEntity(makeEntity({ path: "g-paused.md", type: "goal", title: "Paused Goal", status: "paused" }));
		store.upsertEntity(makeEntity({ path: "p-done.md", type: "project", title: "p-done", goal: "g-done.md" }));
		store.upsertEntity(makeEntity({ path: "p-active.md", type: "project", title: "p-active", goal: "g-active.md" }));
		store.upsertEntity(makeEntity({ path: "p-paused.md", type: "project", title: "p-paused", goal: "g-paused.md" }));
		const plugin = makePlugin(store);

		const groups = groupProjectsByGoal(plugin, { ...EMPTY_MANAGE_FILTER }, DEFAULT_ENTITY_SORT);

		expect(groups.map((g) => g.goal?.status)).toEqual(["active", "paused", "done"]);
	});

	it("G-3: goals sharing the same status are ordered by title ascending", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "g-z.md", type: "goal", title: "Zeta", status: "active" }));
		store.upsertEntity(makeEntity({ path: "g-a.md", type: "goal", title: "Alpha", status: "active" }));
		store.upsertEntity(makeEntity({ path: "p-z.md", type: "project", title: "p-z", goal: "g-z.md" }));
		store.upsertEntity(makeEntity({ path: "p-a.md", type: "project", title: "p-a", goal: "g-a.md" }));
		const plugin = makePlugin(store);

		const groups = groupProjectsByGoal(plugin, { ...EMPTY_MANAGE_FILTER }, DEFAULT_ENTITY_SORT);

		expect(groups.map((g) => g.goal?.title)).toEqual(["Alpha", "Zeta"]);
	});

	it("G-4: a project pointing at a nonexistent goal falls back to '未分類' without crashing", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1", goal: "goal-does-not-exist.md" }));
		const plugin = makePlugin(store);

		const groups = groupProjectsByGoal(plugin, { ...EMPTY_MANAGE_FILTER }, DEFAULT_ENTITY_SORT);

		expect(groups).toHaveLength(1);
		expect(groups[0].goal).toBeNull();
		expect(groups[0].projects.map((p) => p.title)).toEqual(["p1"]);
	});

	it("G-5: a goal group with zero matching projects after filtering is still present, empty", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "goal-a.md", type: "goal", title: "Goal A", status: "active" }));
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1", goal: "goal-a.md", priority: "low" }));
		const plugin = makePlugin(store);
		const filter: ManageFilter = { ...EMPTY_MANAGE_FILTER, priorities: ["high"] };

		const groups = groupProjectsByGoal(plugin, filter, DEFAULT_ENTITY_SORT);

		expect(groups).toHaveLength(1);
		expect(groups[0].goal?.title).toBe("Goal A");
		expect(groups[0].projects).toEqual([]);
	});
});

describe("buildProjectTicketRows (design-drilldown-nav.md §3.2)", () => {
	it("returns only tickets that are direct children of the project", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.upsertEntity(makeEntity({ path: "p2.md", type: "project", title: "p2" }));
		store.upsertEntity(makeEntity({ path: "t1.md", type: "ticket", title: "t1", project: "p1.md" }));
		store.upsertEntity(makeEntity({ path: "t2.md", type: "ticket", title: "t2", project: "p2.md" }));
		const plugin = makePlugin(store);

		const rows = buildProjectTicketRows(plugin, "p1.md", { ...EMPTY_MANAGE_FILTER }, DEFAULT_ENTITY_SORT);

		expect(rows.map((r) => r.entity?.title)).toEqual(["t1"]);
	});

	it("excludes archived tickets by default", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.upsertEntity(makeEntity({ path: "t1.md", type: "ticket", title: "t1", project: "p1.md", status: "doing" }));
		store.upsertEntity(makeEntity({ path: "t2.md", type: "ticket", title: "t2", project: "p1.md", status: "archived" }));
		const plugin = makePlugin(store);

		const rows = buildProjectTicketRows(plugin, "p1.md", { ...EMPTY_MANAGE_FILTER }, DEFAULT_ENTITY_SORT);

		expect(rows.map((r) => r.entity?.title)).toEqual(["t1"]);
	});

	it("applies the given filter (e.g. priority) to the child tickets", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.upsertEntity(makeEntity({ path: "t1.md", type: "ticket", title: "t1", project: "p1.md", priority: "high" }));
		store.upsertEntity(makeEntity({ path: "t2.md", type: "ticket", title: "t2", project: "p1.md", priority: "low" }));
		const plugin = makePlugin(store);

		const rows = buildProjectTicketRows(
			plugin,
			"p1.md",
			{ ...EMPTY_MANAGE_FILTER, priorities: ["high"] },
			DEFAULT_ENTITY_SORT
		);

		expect(rows.map((r) => r.entity?.title)).toEqual(["t1"]);
	});
});

describe("collectProjectTodos (design-drilldown-nav.md §8.4)", () => {
	it("C-1: scope 'direct' returns only todos directly under the project", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.upsertEntity(makeEntity({ path: "t1.md", type: "ticket", title: "t1", project: "p1.md" }));
		store.setTodos("p1.md", [makeTodo({ filePath: "p1.md", parentPath: "p1.md", parentType: "project", text: "direct" })]);
		store.setTodos("t1.md", [makeTodo({ filePath: "t1.md", parentPath: "t1.md", parentType: "ticket", text: "ticket-todo" })]);

		const todos = collectProjectTodos(store, "p1.md", "direct");

		expect(todos.map((t) => t.text)).toEqual(["direct"]);
	});

	it("C-2: scope 'all' with two child tickets combines the direct todos and both tickets' todos", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.upsertEntity(makeEntity({ path: "t1.md", type: "ticket", title: "t1", project: "p1.md" }));
		store.upsertEntity(makeEntity({ path: "t2.md", type: "ticket", title: "t2", project: "p1.md" }));
		store.setTodos("p1.md", [makeTodo({ filePath: "p1.md", parentPath: "p1.md", parentType: "project", text: "direct" })]);
		store.setTodos("t1.md", [makeTodo({ filePath: "t1.md", parentPath: "t1.md", parentType: "ticket", text: "todo1" })]);
		store.setTodos("t2.md", [makeTodo({ filePath: "t2.md", parentPath: "t2.md", parentType: "ticket", text: "todo2" })]);

		const todos = collectProjectTodos(store, "p1.md", "all");

		expect(todos.map((t) => t.text).sort()).toEqual(["direct", "todo1", "todo2"]);
	});

	it("C-3: todos belonging to an archived child ticket are excluded from scope 'all'", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.upsertEntity(makeEntity({ path: "t1.md", type: "ticket", title: "t1", project: "p1.md", status: "doing" }));
		store.upsertEntity(makeEntity({ path: "t2.md", type: "ticket", title: "t2", project: "p1.md", status: "archived" }));
		store.setTodos("t1.md", [makeTodo({ filePath: "t1.md", parentPath: "t1.md", parentType: "ticket", text: "kept" })]);
		store.setTodos("t2.md", [makeTodo({ filePath: "t2.md", parentPath: "t2.md", parentType: "ticket", text: "archived-todo" })]);

		const todos = collectProjectTodos(store, "p1.md", "all");

		expect(todos.map((t) => t.text)).toEqual(["kept"]);
	});

	it("C-4: with zero child tickets, scope 'all' returns only the direct todos without error", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.setTodos("p1.md", [makeTodo({ filePath: "p1.md", parentPath: "p1.md", parentType: "project", text: "direct" })]);

		const todos = collectProjectTodos(store, "p1.md", "all");

		expect(todos.map((t) => t.text)).toEqual(["direct"]);
	});
});
