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
	computeCrossGroupOrder,
	DEFAULT_ENTITY_SORT,
	EMPTY_MANAGE_FILTER,
	entityProgressFraction,
	filterToQueryString,
	isManageVaultEmpty,
	isValidInlineTitle,
	projectTodoFraction,
	queryStringToFilter,
	sortEntityRows,
	ticketTodoFraction,
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

	it("applies period:overdue filter consistently for entities and todos", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "overdue-proj", status: "active", due: "2020-01-01" }));
		store.upsertEntity(makeEntity({ path: "p2.md", type: "project", title: "future-proj", status: "active", due: "2999-01-01" }));
		const plugin = makePlugin(store);

		const rows = buildManageRows(plugin, "project", { ...EMPTY_MANAGE_FILTER, period: "overdue" }, { key: "title", order: "asc" });

		expect(rows.map((r) => r.entity?.title)).toEqual(["overdue-proj"]);
	});
});

describe("sortEntityRows", () => {
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

	it("sorts tickets by status in workflow order (backlog→ready→doing→waiting→review→done→archived)", () => {
		const done = makeEntity({ path: "done.md", title: "done", status: "done" });
		const backlog = makeEntity({ path: "backlog.md", title: "backlog", status: "backlog" });
		const doing = makeEntity({ path: "doing.md", title: "doing", status: "doing" });

		const sorted = sortEntityRows([done, backlog, doing], { key: "status", order: "asc" });

		expect(sorted.map((e) => e.title)).toEqual(["backlog", "doing", "done"]);
	});

	it("sorts projects by status in their own workflow order (backlog→active→waiting→review→done→archived)", () => {
		const archived = makeEntity({ path: "archived.md", type: "project", title: "archived", status: "archived" });
		const active = makeEntity({ path: "active.md", type: "project", title: "active", status: "active" });
		const backlog = makeEntity({ path: "backlog.md", type: "project", title: "backlog", status: "backlog" });

		const sorted = sortEntityRows([archived, active, backlog], { key: "status", order: "asc" });

		expect(sorted.map((e) => e.title)).toEqual(["backlog", "active", "archived"]);
	});

	it("reverses status order when order is desc", () => {
		const backlog = makeEntity({ path: "backlog.md", title: "backlog", status: "backlog" });
		const done = makeEntity({ path: "done.md", title: "done", status: "done" });

		const sorted = sortEntityRows([backlog, done], { key: "status", order: "desc" });

		expect(sorted.map((e) => e.title)).toEqual(["done", "backlog"]);
	});

	it("manual: sorts by order ascending", () => {
		const a = makeEntity({ path: "a.md", title: "a", order: 300 });
		const b = makeEntity({ path: "b.md", title: "b", order: 100 });
		const c = makeEntity({ path: "c.md", title: "c", order: 200 });

		const sorted = sortEntityRows([a, b, c], { key: "manual", order: "asc" });

		expect(sorted.map((e) => e.title)).toEqual(["b", "c", "a"]);
	});

	it("manual: entities with order sort before those without", () => {
		const withOrder = makeEntity({ path: "a.md", title: "zebra", order: 100 });
		const withoutOrder = makeEntity({ path: "b.md", title: "apple" });

		const sorted = sortEntityRows([withoutOrder, withOrder], { key: "manual", order: "asc" });

		expect(sorted.map((e) => e.title)).toEqual(["zebra", "apple"]);
	});

	it("manual: falls back to priority/due/title tie-break when both sides lack order", () => {
		const high = makeEntity({ path: "a.md", title: "a", priority: "high" });
		const low = makeEntity({ path: "b.md", title: "b", priority: "low" });

		const sorted = sortEntityRows([low, high], { key: "manual", order: "asc" });

		expect(sorted.map((e) => e.title)).toEqual(["a", "b"]);
	});
});

describe("computeCrossGroupOrder", () => {
	it("computes a midpoint order when inserting between two rows with orders", () => {
		const targetRows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: 200 },
		];
		expect(computeCrossGroupOrder(targetRows, 1, "before")).toBe(150);
	});

	it("appends after the last order when inserting at the tail", () => {
		const targetRows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: 200 },
		];
		expect(computeCrossGroupOrder(targetRows, 1, "after")).toBe(300);
	});

	it("returns 100 for the first item in an empty target group", () => {
		expect(computeCrossGroupOrder([], 0, "before")).toBe(100);
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

describe("ticketTodoFraction", () => {
	it("F-1: returns done/total from the ticket's own todos", () => {
		const store = new IndexStore();
		store.setTodos("t1.md", [makeTodo({ done: true }), makeTodo({ done: false }), makeTodo({ done: false })]);

		expect(ticketTodoFraction(store, "t1.md")).toEqual({ done: 1, total: 3 });
	});

	it("F-2: returns 0/0 when the ticket has no todos", () => {
		const store = new IndexStore();
		expect(ticketTodoFraction(store, "t1.md")).toEqual({ done: 0, total: 0 });
	});
});

describe("projectTodoFraction", () => {
	it("F-3: aggregates direct todos and non-archived child tickets' todos", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));
		store.upsertEntity(makeEntity({ path: "t1.md", type: "ticket", title: "t1", project: "p1.md", status: "doing" }));
		store.upsertEntity(makeEntity({ path: "t2.md", type: "ticket", title: "t2", project: "p1.md", status: "archived" }));
		store.setTodos("p1.md", [makeTodo({ done: true })]);
		store.setTodos("t1.md", [makeTodo({ done: false }), makeTodo({ done: true })]);
		store.setTodos("t2.md", [makeTodo({ done: false })]); // archived子は除外される

		expect(projectTodoFraction(store, "p1.md")).toEqual({ done: 2, total: 3 });
	});

	it("F-4: returns 0/0 when there are no direct todos and no child tickets", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1" }));

		expect(projectTodoFraction(store, "p1.md")).toEqual({ done: 0, total: 0 });
	});
});

describe("entityProgressFraction", () => {
	it("F-5: delegates to projectTodoFraction for project entities", () => {
		const store = new IndexStore();
		const project = makeEntity({ path: "p1.md", type: "project", title: "p1" });
		store.upsertEntity(project);
		store.setTodos("p1.md", [makeTodo({ done: true }), makeTodo({ done: false })]);

		expect(entityProgressFraction(store, project)).toEqual({ done: 1, total: 2 });
	});

	it("F-6: delegates to ticketTodoFraction for ticket entities", () => {
		const store = new IndexStore();
		const ticket = makeEntity({ path: "t1.md", type: "ticket", title: "t1" });
		store.upsertEntity(ticket);
		store.setTodos("t1.md", [makeTodo({ done: true })]);

		expect(entityProgressFraction(store, ticket)).toEqual({ done: 1, total: 1 });
	});
});

describe("isManageVaultEmpty", () => {
	it("returns true when the store has no projects (initial-launch onboarding state, design-remove-goal.md G2)", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", type: "ticket", title: "orphan ticket" }));

		expect(isManageVaultEmpty(store)).toBe(true);
	});

	it("returns false once a project exists", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "project.md", type: "project", title: "project", status: "active" }));

		expect(isManageVaultEmpty(store)).toBe(false);
	});
});

describe("isValidInlineTitle", () => {
	it("空文字・空白のみは不可", () => {
		expect(isValidInlineTitle("")).toBe(false);
		expect(isValidInlineTitle("   ")).toBe(false);
	});

	it("前後の空白があっても実質的な文字があれば可", () => {
		expect(isValidInlineTitle("  タイトル  ")).toBe(true);
	});
});
