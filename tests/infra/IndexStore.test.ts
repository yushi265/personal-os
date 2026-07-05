import { describe, expect, it } from "vitest";
import { IndexStore } from "../../src/infra/IndexStore";
import type { Entity } from "../../src/domain/entity";

function makeEntity(overrides: Partial<Entity>): Entity {
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

describe("IndexStore", () => {
	it("upserts and retrieves entities by path", () => {
		const store = new IndexStore();
		const e = makeEntity({});
		store.upsertEntity(e);
		expect(store.get(e.path)).toEqual(e);
	});

	it("builds childrenOf from goal/project links and lists them via getChildren", () => {
		const store = new IndexStore();
		const project = makeEntity({
			path: "PersonalOS/Projects/proj-a.md",
			type: "project",
			title: "proj-a",
			status: "active",
			goal: "PersonalOS/Goals/goal-a.md",
		});
		const ticket = makeEntity({
			path: "PersonalOS/Tickets/ticket-a.md",
			project: project.path,
		});
		store.upsertEntity(project);
		store.upsertEntity(ticket);

		expect(store.getChildren(project.path).map((e) => e.path)).toEqual([ticket.path]);
		expect(store.getChildren("PersonalOS/Goals/goal-a.md").map((e) => e.path)).toEqual([project.path]);
	});

	it("removes childrenOf links when an entity is removed", () => {
		const store = new IndexStore();
		const project = makeEntity({ path: "PersonalOS/Projects/proj-a.md", type: "project", title: "proj-a" });
		const ticket = makeEntity({ project: project.path });
		store.upsertEntity(project);
		store.upsertEntity(ticket);

		store.remove(ticket.path);

		expect(store.getChildren(project.path)).toEqual([]);
		expect(store.get(ticket.path)).toBeUndefined();
	});

	it("re-links childrenOf when an entity is upserted again with a different parent", () => {
		const store = new IndexStore();
		const projectA = makeEntity({ path: "PersonalOS/Projects/a.md", type: "project", title: "a" });
		const projectB = makeEntity({ path: "PersonalOS/Projects/b.md", type: "project", title: "b" });
		const ticket = makeEntity({ project: projectA.path });
		store.upsertEntity(projectA);
		store.upsertEntity(projectB);
		store.upsertEntity(ticket);

		store.upsertEntity({ ...ticket, project: projectB.path });

		expect(store.getChildren(projectA.path)).toEqual([]);
		expect(store.getChildren(projectB.path).map((e) => e.path)).toEqual([ticket.path]);
	});

	it("handles rename by moving entity + todos to the new path", () => {
		const store = new IndexStore();
		const oldPath = "PersonalOS/Tickets/old.md";
		const entity = makeEntity({ path: oldPath });
		store.upsertEntity(entity);
		store.setTodos(oldPath, [
			{
				filePath: oldPath,
				line: 0,
				text: "do it",
				done: false,
				labels: [],
				parentType: "ticket",
				parentPath: oldPath,
			},
		]);

		const newPath = "PersonalOS/Tickets/new.md";
		const renamed = { ...entity, path: newPath, title: "new" };
		store.handleRename(oldPath, renamed, store.getTodos(oldPath));

		expect(store.get(oldPath)).toBeUndefined();
		expect(store.get(newPath)).toEqual(renamed);
		expect(store.getTodos(oldPath)).toEqual([]);
		expect(store.getTodos(newPath)).toHaveLength(1);
	});

	it("listByType returns entities sorted by title ascending", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", title: "banana" }));
		store.upsertEntity(makeEntity({ path: "b.md", title: "apple" }));
		store.upsertEntity(makeEntity({ path: "c.md", title: "cherry" }));

		expect(store.listByType("ticket").map((e) => e.title)).toEqual(["apple", "banana", "cherry"]);
	});

	it("listByType sorts by order ascending when both sides have order", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", title: "banana", order: 300 }));
		store.upsertEntity(makeEntity({ path: "b.md", title: "apple", order: 100 }));
		store.upsertEntity(makeEntity({ path: "c.md", title: "cherry", order: 200 }));

		expect(store.listByType("ticket").map((e) => e.title)).toEqual(["apple", "cherry", "banana"]);
	});

	it("listByType sorts entities with order before entities without order", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", title: "zebra", order: 100 }));
		store.upsertEntity(makeEntity({ path: "b.md", title: "apple" }));

		expect(store.listByType("ticket").map((e) => e.title)).toEqual(["zebra", "apple"]);
	});

	it("listByType falls back to title compare when both sides lack order", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md", title: "banana" }));
		store.upsertEntity(makeEntity({ path: "b.md", title: "apple" }));

		expect(store.listByType("ticket").map((e) => e.title)).toEqual(["apple", "banana"]);
	});

	it("tracks parse errors and clears them once an entity parses successfully", () => {
		const store = new IndexStore();
		store.addParseError("bad.md", "不正なtype");
		expect(store.getParseErrors()).toEqual([{ path: "bad.md", reason: "不正なtype" }]);

		store.upsertEntity(makeEntity({ path: "bad.md" }));
		expect(store.getParseErrors()).toEqual([]);
	});

	it("stats reports entity/todo/error counts", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		store.setTodos("a.md", [
			{ filePath: "a.md", line: 0, text: "x", done: false, labels: [], parentType: "ticket", parentPath: "a.md" },
			{ filePath: "a.md", line: 1, text: "y", done: true, labels: [], parentType: "ticket", parentPath: "a.md" },
		]);
		store.addParseError("bad.md", "reason");

		expect(store.stats()).toEqual({ entities: 1, todos: 2, errors: 1 });
	});
});
