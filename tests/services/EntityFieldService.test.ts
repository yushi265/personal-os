import { describe, expect, it, vi } from "vitest";
import { EntityFieldService } from "../../src/services/EntityFieldService";
import type { Entity } from "../../src/domain/entity";
import { IndexStore } from "../../src/infra/IndexStore";
import type { VaultRepository } from "../../src/infra/VaultRepository";
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

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		updateFrontmatter: vi.fn().mockResolvedValue(undefined),
		renameNote: vi.fn().mockResolvedValue("PersonalOS/Tickets/new-title.md"),
		...overrides,
	} as unknown as VaultRepository;
}

function makeActivityLog() {
	return { log: vi.fn().mockResolvedValue(undefined) } as unknown as ActivityLogger;
}

describe("EntityFieldService.updateField", () => {
	it("E-1: rejects a status value outside the type's valid statuses", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const service = new EntityFieldService(makeRepo(), store, makeActivityLog());

		await expect(service.updateField("PersonalOS/Tickets/ticket-a.md", "status", "not-a-status")).rejects.toThrow();
	});

	it("E-2: rejects an invalid priority value", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const service = new EntityFieldService(makeRepo(), store, makeActivityLog());

		await expect(service.updateField("PersonalOS/Tickets/ticket-a.md", "priority", "urgent")).rejects.toThrow();
	});

	it("E-3: rejects a due date not in YYYY-MM-DD format", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const service = new EntityFieldService(makeRepo(), store, makeActivityLog());

		await expect(service.updateField("PersonalOS/Tickets/ticket-a.md", "due", "2026/07/10")).rejects.toThrow();
	});

	it("E-4: rejects a goal value pointing at a non-goal entity", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		store.upsertEntity(makeEntity({ path: "PersonalOS/Tickets/ticket-b.md", title: "ticket-b" }));
		const service = new EntityFieldService(makeRepo(), store, makeActivityLog());

		await expect(
			service.updateField("PersonalOS/Tickets/ticket-a.md", "goal", "PersonalOS/Tickets/ticket-b.md")
		).rejects.toThrow();
	});

	it("E-5: rejects an empty title", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const service = new EntityFieldService(makeRepo(), store, makeActivityLog());

		await expect(service.updateField("PersonalOS/Tickets/ticket-a.md", "title", "")).rejects.toThrow();
	});

	it("E-6: renames using the forbidden-char-replaced title", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.updateField("PersonalOS/Tickets/ticket-a.md", "title", "a/b:c");

		expect(repo.renameNote).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md", "a-b-c");
	});

	it("E-7: allows clearing tags with an empty array", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ tags: ["old"] }));
		const repo = makeRepo();
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.updateField("PersonalOS/Tickets/ticket-a.md", "tags", []);

		expect(repo.updateFrontmatter).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md", expect.any(Function));
		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = { tags: ["old"] };
		fn(fm);
		expect(fm.tags).toEqual([]);
	});

	it("E-8: preserves unknown frontmatter properties when writing priority (processFrontMatter characteristic)", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.updateField("PersonalOS/Tickets/ticket-a.md", "priority", "high");

		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = { type: "ticket", customField: "kept" };
		fn(fm);
		expect(fm.priority).toBe("high");
		expect(fm.customField).toBe("kept");
	});
});
