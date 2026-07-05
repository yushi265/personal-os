import { describe, expect, it, vi } from "vitest";
import type { TFile } from "obsidian";
import { ApiRouter } from "../../src/server/ApiRouter";
import type { ApiDeps } from "../../src/server/types";
import { IndexStore } from "../../src/infra/IndexStore";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";
import type { EntityService } from "../../src/services/EntityService";
import type { EntityFieldService } from "../../src/services/EntityFieldService";
import type { TodoService } from "../../src/services/TodoService";
import type { CommentService } from "../../src/services/CommentService";
import type { NoteService } from "../../src/services/NoteService";
import { PromoteConflictError, type PromoteService } from "../../src/services/PromoteService";

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

interface Mocks {
	deps: ApiDeps;
	store: IndexStore;
	entityService: { create: ReturnType<typeof vi.fn>; changeStatus: ReturnType<typeof vi.fn>; archive: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
	entityFieldService: { updateField: ReturnType<typeof vi.fn> };
	todoService: {
		addToSection: ReturnType<typeof vi.fn>;
		toggle: ReturnType<typeof vi.fn>;
		updateInline: ReturnType<typeof vi.fn>;
		remove: ReturnType<typeof vi.fn>;
		list: ReturnType<typeof vi.fn>;
	};
	commentService: { list: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
	noteService: { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
	promoteService: { promoteTodoToTicket: ReturnType<typeof vi.fn>; promoteTicketToProject: ReturnType<typeof vi.fn> };
}

function makeMocks(): Mocks {
	const store = new IndexStore();
	const entityService = {
		create: vi.fn().mockResolvedValue({ path: "PersonalOS/Tickets/new.md" } as unknown as TFile),
		changeStatus: vi.fn().mockResolvedValue(undefined),
		archive: vi.fn().mockResolvedValue("PersonalOS/Archive/ticket-a.md"),
		delete: vi.fn().mockResolvedValue(undefined),
	};
	const entityFieldService = { updateField: vi.fn().mockResolvedValue(undefined) };
	const todoService = {
		addToSection: vi.fn().mockResolvedValue(undefined),
		toggle: vi.fn().mockResolvedValue("ok"),
		updateInline: vi.fn().mockResolvedValue("ok"),
		remove: vi.fn().mockResolvedValue("ok"),
		list: vi.fn().mockReturnValue([]),
	};
	const commentService = {
		list: vi.fn().mockResolvedValue([]),
		add: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue("ok"),
		remove: vi.fn().mockResolvedValue("ok"),
	};
	const noteService = {
		get: vi.fn().mockResolvedValue(""),
		save: vi.fn().mockResolvedValue(undefined),
	};
	const promoteService = {
		promoteTodoToTicket: vi.fn().mockResolvedValue(undefined),
		promoteTicketToProject: vi.fn().mockResolvedValue(undefined),
	};

	const deps: ApiDeps = {
		getVaultName: () => "test-vault",
		getCapability: () => ({ todoFeatures: true }),
		getPort: () => 27141,
		store,
		entityService: entityService as unknown as EntityService,
		entityFieldService: entityFieldService as unknown as EntityFieldService,
		todoService: todoService as unknown as TodoService,
		commentService: commentService as unknown as CommentService,
		noteService: noteService as unknown as NoteService,
		promoteService: promoteService as unknown as PromoteService,
		sseHub: { subscribe: vi.fn(), closeAll: vi.fn() } as unknown as ApiDeps["sseHub"],
		getWebappDistDir: () => "/tmp/webapp-dist",
	};

	return { deps, store, entityService, entityFieldService, todoService, commentService, noteService, promoteService };
}

describe("ApiRouter.handle: /api/meta", () => {
	it("returns vaultName/capability/port from deps", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/meta", {}, undefined, deps);
		expect(res).toEqual({ status: 200, body: { vaultName: "test-vault", capability: { todoFeatures: true }, port: 27141 } });
	});
});

describe("ApiRouter.handle: GET /api/summary", () => {
	it("aggregates todos/entities via judge.ts, delegating today's todos to todoService.list", async () => {
		const { deps, store, todoService } = makeMocks();
		todoService.list.mockReturnValue([makeTodo({ text: "today", dueDate: "2026-07-04" })]);
		store.setTodos("ticket-a.md", [makeTodo({ done: false, dueDate: "2026-07-01" })]); // overdue
		store.upsertEntity(makeEntity({ path: "p1.md", type: "project", title: "p1", status: "active", blockers: ["x"] }));
		store.upsertEntity(
			makeEntity({ path: "p2.md", type: "project", title: "p2", status: "backlog", reviewCycle: "weekly", lastReviewed: undefined })
		);

		const res = await ApiRouter.handle("GET", "/api/summary", {}, undefined, deps);

		expect(res.status).toBe(200);
		const body = res.body as {
			todayTodos: unknown[];
			overdueTodos: unknown[];
			blockedEntities: { path: string }[];
			reviewNeededEntities: { path: string }[];
			activeProjectCount: number;
		};
		expect(todoService.list).toHaveBeenCalledWith({ done: false, dueOn: expect.any(String) });
		expect(body.todayTodos).toHaveLength(1);
		expect(body.overdueTodos).toHaveLength(1);
		expect(body.blockedEntities.map((e) => e.path)).toEqual(["p1.md"]);
		expect(body.reviewNeededEntities.map((e) => e.path)).toEqual(["p2.md"]);
		expect(body.activeProjectCount).toBe(1);
	});

	it("returns empty todo lists when todoFeatures capability is off", async () => {
		const { deps, store, todoService } = makeMocks();
		deps.getCapability = () => ({ todoFeatures: false });
		store.setTodos("ticket-a.md", [makeTodo({ dueDate: "2026-07-01" })]);

		const res = await ApiRouter.handle("GET", "/api/summary", {}, undefined, deps);

		const body = res.body as { todayTodos: unknown[]; overdueTodos: unknown[] };
		expect(body.todayTodos).toEqual([]);
		expect(body.overdueTodos).toEqual([]);
		expect(todoService.list).not.toHaveBeenCalled();
	});
});

describe("ApiRouter.handle: GET /api/entities", () => {
	it("returns entities for a given type", async () => {
		const { deps, store } = makeMocks();
		store.upsertEntity(makeEntity({ path: "p1", type: "project", title: "project-a" }));
		const res = await ApiRouter.handle("GET", "/api/entities", { type: "project" }, undefined, deps);
		expect(res.status).toBe(200);
		expect((res.body as { entities: Entity[] }).entities.map((e) => e.path)).toEqual(["p1"]);
	});

	it("returns 400 when type is missing", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/entities", {}, undefined, deps);
		expect(res.status).toBe(400);
	});

	it("returns 400 for an invalid type", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/entities", { type: "bogus" }, undefined, deps);
		expect(res.status).toBe(400);
	});
});

describe("ApiRouter.handle: GET /api/entity", () => {
	it("returns the entity when found", async () => {
		const { deps, store } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("GET", "/api/entity", { path: "a.md" }, undefined, deps);
		expect(res).toEqual({ status: 200, body: store.get("a.md") });
	});

	it("returns 404/E102 when not found", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/entity", { path: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
		expect((res.body as { code: string }).code).toBe("E102");
	});
});

describe("ApiRouter.handle: GET /api/entity/children", () => {
	it("returns children when the parent exists", async () => {
		const { deps, store } = makeMocks();
		store.upsertEntity(makeEntity({ path: "project-a.md", type: "project" }));
		store.upsertEntity(makeEntity({ path: "ticket-a.md", type: "ticket", project: "project-a.md" }));
		const res = await ApiRouter.handle("GET", "/api/entity/children", { path: "project-a.md" }, undefined, deps);
		expect(res.status).toBe(200);
		expect((res.body as { entities: Entity[] }).entities.map((e) => e.path)).toEqual(["ticket-a.md"]);
	});

	it("returns 404 when the parent does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/entity/children", { path: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: POST /api/entities", () => {
	it("delegates to entityService.create and returns the created path", async () => {
		const { deps, entityService } = makeMocks();
		const input = { type: "ticket", title: "new ticket" };
		const res = await ApiRouter.handle("POST", "/api/entities", {}, input, deps);
		expect(entityService.create).toHaveBeenCalledWith(input);
		expect(res).toEqual({ status: 201, body: { path: "PersonalOS/Tickets/new.md" } });
	});

	it("returns 400 with the service's error message on failure", async () => {
		const { deps, entityService } = makeMocks();
		entityService.create.mockRejectedValue(new Error("duplicate title"));
		const res = await ApiRouter.handle("POST", "/api/entities", {}, { type: "ticket", title: "x" }, deps);
		expect(res).toEqual({ status: 400, body: { error: "duplicate title" } });
	});
});

describe("ApiRouter.handle: PATCH /api/entity/field", () => {
	it("delegates to entityFieldService.updateField", async () => {
		const { deps, store, entityFieldService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("PATCH", "/api/entity/field", { path: "a.md" }, { key: "priority", value: "high" }, deps);
		expect(entityFieldService.updateField).toHaveBeenCalledWith("a.md", "priority", "high");
		expect(res.status).toBe(200);
	});

	it("returns 400 when the field validation throws", async () => {
		const { deps, store, entityFieldService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		entityFieldService.updateField.mockRejectedValue(new Error("不正なpriority"));
		const res = await ApiRouter.handle("PATCH", "/api/entity/field", { path: "a.md" }, { key: "priority", value: "bogus" }, deps);
		expect(res).toEqual({ status: 400, body: { error: "不正なpriority" } });
	});

	it("returns 404 when the entity does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("PATCH", "/api/entity/field", { path: "missing.md" }, { key: "priority", value: "high" }, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: POST /api/entity/status", () => {
	it("delegates to entityService.changeStatus", async () => {
		const { deps, store, entityService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("POST", "/api/entity/status", { path: "a.md" }, { next: "done" }, deps);
		expect(entityService.changeStatus).toHaveBeenCalledWith("a.md", "done");
		expect(res.status).toBe(200);
	});

	it("returns 404 when the entity does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("POST", "/api/entity/status", { path: "missing.md" }, { next: "done" }, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: POST /api/entity/archive", () => {
	it("returns the archived path", async () => {
		const { deps, store } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("POST", "/api/entity/archive", { path: "a.md" }, undefined, deps);
		expect(res).toEqual({ status: 200, body: { path: "PersonalOS/Archive/ticket-a.md" } });
	});

	it("returns 404 when the entity does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("POST", "/api/entity/archive", { path: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: DELETE /api/entity", () => {
	it("delegates to entityService.delete", async () => {
		const { deps, store, entityService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("DELETE", "/api/entity", { path: "a.md" }, undefined, deps);
		expect(entityService.delete).toHaveBeenCalledWith("a.md");
		expect(res.status).toBe(200);
	});

	it("returns 404 when the entity does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("DELETE", "/api/entity", { path: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: POST /api/entity/promote-todo", () => {
	it("delegates to promoteService.promoteTodoToTicket", async () => {
		const { deps, promoteService } = makeMocks();
		const todo = makeTodo();
		const options = { newTitle: "new ticket", sourceAction: "delete" };
		const res = await ApiRouter.handle("POST", "/api/entity/promote-todo", { path: todo.filePath }, { todo, options }, deps);
		expect(promoteService.promoteTodoToTicket).toHaveBeenCalledWith(todo, options);
		expect(res.status).toBe(200);
	});

	it("returns 409/E004 on PromoteConflictError", async () => {
		const { deps, promoteService } = makeMocks();
		promoteService.promoteTodoToTicket.mockRejectedValue(new PromoteConflictError());
		const todo = makeTodo();
		const res = await ApiRouter.handle(
			"POST",
			"/api/entity/promote-todo",
			{},
			{ todo, options: { newTitle: "x", sourceAction: "delete" } },
			deps
		);
		expect(res.status).toBe(409);
		expect((res.body as { code: string }).code).toBe("E004");
	});

	it("returns 400 for a malformed body", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("POST", "/api/entity/promote-todo", {}, { todo: makeTodo() }, deps);
		expect(res.status).toBe(400);
	});
});

describe("ApiRouter.handle: POST /api/entity/promote-ticket", () => {
	it("delegates to promoteService.promoteTicketToProject", async () => {
		const { deps, store, promoteService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("POST", "/api/entity/promote-ticket", { path: "a.md" }, undefined, deps);
		expect(promoteService.promoteTicketToProject).toHaveBeenCalledWith("a.md");
		expect(res.status).toBe(200);
	});

	it("returns 404 when the ticket does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("POST", "/api/entity/promote-ticket", { path: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: GET /api/todos", () => {
	it("returns direct todos by default", async () => {
		const { deps, store } = makeMocks();
		store.upsertEntity(makeEntity({ path: "project-a.md", type: "project" }));
		store.setTodos("project-a.md", [makeTodo({ parentPath: "project-a.md", parentType: "project" })]);
		const res = await ApiRouter.handle("GET", "/api/todos", { parent: "project-a.md" }, undefined, deps);
		expect(res.status).toBe(200);
		expect((res.body as { todos: Todo[] }).todos).toHaveLength(1);
	});

	it("returns 404 when the parent does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/todos", { parent: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: POST /api/todos", () => {
	it("delegates to todoService.addToSection", async () => {
		const { deps, store, todoService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("POST", "/api/todos", { parent: "a.md" }, { text: "new todo" }, deps);
		expect(todoService.addToSection).toHaveBeenCalledWith("a.md", { text: "new todo" });
		expect(res.status).toBe(201);
	});
});

describe("ApiRouter.handle: PATCH /api/todos/toggle", () => {
	it("returns 200 on success", async () => {
		const { deps, todoService } = makeMocks();
		const todo = makeTodo();
		const res = await ApiRouter.handle("PATCH", "/api/todos/toggle", {}, todo, deps);
		expect(todoService.toggle).toHaveBeenCalledWith(todo);
		expect(res.status).toBe(200);
	});

	it("returns 409/E003 on line-mismatch conflict", async () => {
		const { deps, todoService } = makeMocks();
		todoService.toggle.mockResolvedValue("conflict");
		const res = await ApiRouter.handle("PATCH", "/api/todos/toggle", {}, makeTodo(), deps);
		expect(res.status).toBe(409);
		expect((res.body as { code: string }).code).toBe("E003");
	});
});

describe("ApiRouter.handle: PATCH /api/todos", () => {
	it("delegates to todoService.updateInline", async () => {
		const { deps, todoService } = makeMocks();
		const todo = makeTodo();
		const patch = { text: "updated" };
		const res = await ApiRouter.handle("PATCH", "/api/todos", {}, { todo, patch }, deps);
		expect(todoService.updateInline).toHaveBeenCalledWith(todo, patch);
		expect(res.status).toBe(200);
	});

	it("returns 409/E003 on conflict", async () => {
		const { deps, todoService } = makeMocks();
		todoService.updateInline.mockResolvedValue("conflict");
		const res = await ApiRouter.handle("PATCH", "/api/todos", {}, { todo: makeTodo(), patch: {} }, deps);
		expect(res.status).toBe(409);
	});
});

describe("ApiRouter.handle: DELETE /api/todos", () => {
	it("delegates to todoService.remove", async () => {
		const { deps, todoService } = makeMocks();
		const todo = makeTodo();
		const res = await ApiRouter.handle("DELETE", "/api/todos", {}, todo, deps);
		expect(todoService.remove).toHaveBeenCalledWith(todo);
		expect(res.status).toBe(200);
	});

	it("returns 409/E003 on conflict", async () => {
		const { deps, todoService } = makeMocks();
		todoService.remove.mockResolvedValue("conflict");
		const res = await ApiRouter.handle("DELETE", "/api/todos", {}, makeTodo(), deps);
		expect(res.status).toBe(409);
	});
});

describe("ApiRouter.handle: /api/memos (comments; API path kept as-is per design-reorder-and-notes.md B-4)", () => {
	it("GET returns the comment list", async () => {
		const { deps, store, commentService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		commentService.list.mockResolvedValue([{ datetime: "2026-07-04 10:00", text: "hi" }]);
		const res = await ApiRouter.handle("GET", "/api/memos", { path: "a.md" }, undefined, deps);
		expect(res.status).toBe(200);
		expect((res.body as { memos: unknown[] }).memos).toHaveLength(1);
	});

	it("GET returns 404 when the note does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/memos", { path: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
	});

	it("POST delegates to commentService.add", async () => {
		const { deps, store, commentService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("POST", "/api/memos", { path: "a.md" }, { text: "new memo" }, deps);
		expect(commentService.add).toHaveBeenCalledWith("a.md", "new memo");
		expect(res.status).toBe(201);
	});

	it("PATCH returns 409/E007 on conflict", async () => {
		const { deps, store, commentService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		commentService.update.mockResolvedValue("conflict");
		const expected = { datetime: "2026-07-04 10:00", text: "old" };
		const res = await ApiRouter.handle("PATCH", "/api/memos", { path: "a.md" }, { expected, newText: "new" }, deps);
		expect(res.status).toBe(409);
		expect((res.body as { code: string }).code).toBe("E007");
	});

	it("DELETE returns 409/E007 on conflict", async () => {
		const { deps, store, commentService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		commentService.remove.mockResolvedValue("conflict");
		const expected = { datetime: "2026-07-04 10:00", text: "old" };
		const res = await ApiRouter.handle("DELETE", "/api/memos", { path: "a.md" }, { expected }, deps);
		expect(res.status).toBe(409);
		expect((res.body as { code: string }).code).toBe("E007");
	});

	it("DELETE returns 200 on success", async () => {
		const { deps, store, commentService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const expected = { datetime: "2026-07-04 10:00", text: "old" };
		const res = await ApiRouter.handle("DELETE", "/api/memos", { path: "a.md" }, { expected }, deps);
		expect(commentService.remove).toHaveBeenCalledWith("a.md", expected);
		expect(res.status).toBe(200);
	});
});

describe("ApiRouter.handle: /api/note", () => {
	it("GET delegates to noteService.get and returns the text", async () => {
		const { deps, store, noteService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		noteService.get.mockResolvedValue("my note");
		const res = await ApiRouter.handle("GET", "/api/note", { path: "a.md" }, undefined, deps);
		expect(noteService.get).toHaveBeenCalledWith("a.md");
		expect(res.status).toBe(200);
		expect((res.body as { text: string }).text).toBe("my note");
	});

	it("GET returns 404 when the note does not exist", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/note", { path: "missing.md" }, undefined, deps);
		expect(res.status).toBe(404);
	});

	it("PUT delegates to noteService.save", async () => {
		const { deps, store, noteService } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("PUT", "/api/note", { path: "a.md" }, { text: "updated note" }, deps);
		expect(noteService.save).toHaveBeenCalledWith("a.md", "updated note");
		expect(res.status).toBe(200);
	});

	it("PUT returns 400 when body is invalid", async () => {
		const { deps, store } = makeMocks();
		store.upsertEntity(makeEntity({ path: "a.md" }));
		const res = await ApiRouter.handle("PUT", "/api/note", { path: "a.md" }, {}, deps);
		expect(res.status).toBe(400);
	});
});

describe("ApiRouter.handle: unmatched routes", () => {
	it("returns 404 for an unknown path", async () => {
		const { deps } = makeMocks();
		const res = await ApiRouter.handle("GET", "/api/unknown", {}, undefined, deps);
		expect(res.status).toBe(404);
	});
});

describe("ApiRouter.handle: unexpected errors", () => {
	it("returns 500/E999 and logs when a dependency throws unexpectedly", async () => {
		const { deps, store } = makeMocks();
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(store, "get").mockImplementation(() => {
			throw new Error("boom");
		});

		const res = await ApiRouter.handle("GET", "/api/entity", { path: "a.md" }, undefined, deps);

		expect(res.status).toBe(500);
		expect((res.body as { code: string }).code).toBe("E999");
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
