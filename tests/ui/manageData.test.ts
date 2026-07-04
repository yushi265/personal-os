import { describe, expect, it } from "vitest";
import { IndexStore } from "../../src/infra/IndexStore";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";
import type PersonalOSPlugin from "../../src/main";
import {
	buildManageRows,
	collectKnownLabels,
	collectKnownTags,
	EMPTY_MANAGE_FILTER,
	filterToQueryString,
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
