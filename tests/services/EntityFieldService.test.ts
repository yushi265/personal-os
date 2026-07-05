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
		hasBasenameCollision: vi.fn().mockReturnValue(false),
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

	it("E-9: allows updating order via the generic switch", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.updateField("PersonalOS/Tickets/ticket-a.md", "order", 150);

		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = {};
		fn(fm);
		expect(fm.order).toBe(150);
	});

	it("E-10: rejects a non-numeric order value", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const service = new EntityFieldService(makeRepo(), store, makeActivityLog());

		await expect(service.updateField("PersonalOS/Tickets/ticket-a.md", "order", "not-a-number")).rejects.toThrow();
	});
});

describe("EntityFieldService.reorder", () => {
	it("R-1: writes the order field directly, bypassing validate/ActivityLog", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const activityLog = makeActivityLog();
		const service = new EntityFieldService(repo, store, activityLog);

		await service.reorder("PersonalOS/Tickets/ticket-a.md", 250);

		expect(repo.updateFrontmatter).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md", expect.any(Function));
		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = {};
		fn(fm);
		expect(fm.order).toBe(250);
		expect(activityLog.log).not.toHaveBeenCalled();
	});
});

describe("EntityFieldService.reorderAndReassignGoal", () => {
	it("G-1: writes goal and order in a single frontmatter update call", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ type: "project", path: "PersonalOS/Projects/p1.md", title: "p1" }));
		store.upsertEntity({
			path: "PersonalOS/Goals/g1.md",
			type: "goal",
			title: "g1",
			status: "active",
			tags: [],
			labels: [],
			blockers: [],
			extra: {},
		});
		const repo = makeRepo();
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.reorderAndReassignGoal("PersonalOS/Projects/p1.md", 150, "PersonalOS/Goals/g1.md");

		expect(repo.updateFrontmatter).toHaveBeenCalledTimes(1);
		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = {};
		fn(fm);
		expect(fm.order).toBe(150);
		expect(fm.goal).toBe("[[g1]]");
	});

	it("G-2: clears goal when newGoal is undefined", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ type: "project", path: "PersonalOS/Projects/p1.md", title: "p1" }));
		const repo = makeRepo();
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.reorderAndReassignGoal("PersonalOS/Projects/p1.md", 100, undefined);

		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = { goal: "[[old]]" };
		fn(fm);
		expect(fm.order).toBe(100);
		expect(fm.goal).toBeUndefined();
	});
});

// バグ修正: 同basenameの別ファイルが存在するとbasenameのみのwikilinkは曖昧に解決されるため、
// 衝突がある場合はパス付きリンクを書く。
describe("EntityFieldService — unambiguous parent links on basename collision", () => {
	it("updateField('project'): writes a bare-title wikilink when there is no collision", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		store.upsertEntity({
			path: "PersonalOS/Projects/proj-a.md",
			type: "project",
			title: "proj-a",
			status: "active",
			tags: [],
			labels: [],
			blockers: [],
			extra: {},
		});
		const repo = makeRepo({ hasBasenameCollision: vi.fn().mockReturnValue(false) });
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.updateField("PersonalOS/Tickets/ticket-a.md", "project", "PersonalOS/Projects/proj-a.md");

		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = {};
		fn(fm);
		expect(fm.project).toBe("[[proj-a]]");
	});

	it("updateField('project'): writes a path-qualified wikilink when the title collides with another file's basename", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		store.upsertEntity({
			path: "PersonalOS/Projects/てすと.md",
			type: "project",
			title: "てすと",
			status: "active",
			tags: [],
			labels: [],
			blockers: [],
			extra: {},
		});
		const hasBasenameCollision = vi.fn().mockReturnValue(true);
		const repo = makeRepo({ hasBasenameCollision });
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.updateField("PersonalOS/Tickets/ticket-a.md", "project", "PersonalOS/Projects/てすと.md");

		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = {};
		fn(fm);
		expect(hasBasenameCollision).toHaveBeenCalledWith("てすと");
		expect(fm.project).toBe("[[PersonalOS/Projects/てすと]]");
	});

	it("reorderAndReassignGoal: writes a path-qualified goal link when the title collides", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ type: "project", path: "PersonalOS/Projects/p1.md", title: "p1" }));
		store.upsertEntity({
			path: "PersonalOS/Goals/てすと.md",
			type: "goal",
			title: "てすと",
			status: "active",
			tags: [],
			labels: [],
			blockers: [],
			extra: {},
		});
		const hasBasenameCollision = vi.fn().mockReturnValue(true);
		const repo = makeRepo({ hasBasenameCollision });
		const service = new EntityFieldService(repo, store, makeActivityLog());

		await service.reorderAndReassignGoal("PersonalOS/Projects/p1.md", 150, "PersonalOS/Goals/てすと.md");

		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = {};
		fn(fm);
		expect(fm.goal).toBe("[[PersonalOS/Goals/てすと]]");
	});
});
