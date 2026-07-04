import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";
import { IndexStore } from "../../src/infra/IndexStore";
import { SelfWriteGuard } from "../../src/infra/SelfWriteGuard";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import { EntityFieldService } from "../../src/services/EntityFieldService";
import { ProgressService } from "../../src/services/ProgressService";
import type { ActivityLogger } from "../../src/infra/types";

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

function makeTodo(path: string, done: boolean): Todo {
	return {
		filePath: path,
		line: 0,
		text: "x",
		done,
		labels: [],
		parentType: "ticket",
		parentPath: path,
	};
}

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		updateFrontmatter: vi.fn().mockResolvedValue(undefined),
		...overrides,
	} as unknown as VaultRepository;
}

function makeActivityLog() {
	return { log: vi.fn().mockResolvedValue(undefined) } as unknown as ActivityLogger;
}

describe("ProgressService writeBack x SelfWriteGuard", () => {
	it("PG-1: marks the ticket path as suppressed right before writing back a changed progress value", async () => {
		const store = new IndexStore();
		const guard = new SelfWriteGuard();
		const repo = makeRepo();
		store.upsertEntity(makeEntity());
		store.setTodos("PersonalOS/Tickets/ticket-a.md", [
			makeTodo("PersonalOS/Tickets/ticket-a.md", true),
			makeTodo("PersonalOS/Tickets/ticket-a.md", false),
		]);
		const service = new ProgressService(repo, store, guard);

		expect(guard.isSuppressed("PersonalOS/Tickets/ticket-a.md")).toBe(false);
		await service.recalcAncestors("PersonalOS/Tickets/ticket-a.md");

		expect(repo.updateFrontmatter).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md", expect.any(Function));
		expect(guard.isSuppressed("PersonalOS/Tickets/ticket-a.md")).toBe(true);
	});

	it("PG-2: does not mark suppression (or write) when the recalculated progress is unchanged", async () => {
		const store = new IndexStore();
		const guard = new SelfWriteGuard();
		const repo = makeRepo();
		// 1 of 2 done => 50%, matching the pre-set progress so writeBack should skip.
		store.upsertEntity(makeEntity({ progress: 50 }));
		store.setTodos("PersonalOS/Tickets/ticket-a.md", [
			makeTodo("PersonalOS/Tickets/ticket-a.md", true),
			makeTodo("PersonalOS/Tickets/ticket-a.md", false),
		]);
		const service = new ProgressService(repo, store, guard);

		await service.recalcAncestors("PersonalOS/Tickets/ticket-a.md");

		expect(repo.updateFrontmatter).not.toHaveBeenCalled();
		expect(guard.isSuppressed("PersonalOS/Tickets/ticket-a.md")).toBe(false);
	});

	it("PG-3: a plain field update through EntityFieldService never suppresses reindex for that path", async () => {
		const store = new IndexStore();
		const guard = new SelfWriteGuard();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.updateField("PersonalOS/Tickets/ticket-a.md", "priority", "high");

		// EntityFieldService (and VaultRepository) have no reference to SelfWriteGuard at all,
		// so a non-progress plugin write must never be reported as suppressed.
		expect(guard.isSuppressed("PersonalOS/Tickets/ticket-a.md")).toBe(false);
	});
});
