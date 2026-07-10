import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";
import { IndexStore } from "../../src/infra/IndexStore";
import { SelfWriteGuard } from "../../src/infra/SelfWriteGuard";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import { EntityFieldService } from "../../src/services/EntityFieldService";
import { EntityService } from "../../src/services/EntityService";
import { ProgressService } from "../../src/services/ProgressService";
import type { ActivityLogger } from "../../src/infra/types";
import { DEFAULT_SETTINGS, type POSSettings } from "../../src/settings/settings";

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

// バグ再現防止: 作成直後にmetadataCache changed→recalcAncestorsが走っても、
// 他プラグイン(update-time-on-editなど)とのfrontmatter競合を招く2回目の書き込みが発生しないこと
describe("EntityService.create x ProgressService.recalcAncestors — no double write right after creation", () => {
	it("does not call updateFrontmatter when recalcAncestors runs immediately after create (no todos yet)", async () => {
		const store = new IndexStore();
		const guard = new SelfWriteGuard();
		const repo = {
			readBody: vi.fn().mockResolvedValue(""),
			createEntityNote: vi.fn().mockResolvedValue({ path: "PersonalOS/Tickets/new-ticket.md", basename: "new-ticket" }),
			updateFrontmatter: vi.fn().mockResolvedValue(undefined),
		} as unknown as VaultRepository;
		const settings = DEFAULT_SETTINGS as POSSettings;
		const entityService = new EntityService(repo, store, settings);
		const progressService = new ProgressService(repo, store, guard);

		const file = await entityService.create({ type: "ticket", title: "new-ticket" });
		// simulate the metadataCache "changed" event firing right after creation and
		// the indexer invoking progress recalculation for the newly created ticket.
		await progressService.recalcAncestors(file.path);

		expect(repo.updateFrontmatter).not.toHaveBeenCalled();
		expect(guard.isSuppressed(file.path)).toBe(false);
	});
});

// POS-3 AC-6: cancelledチケットはプロジェクト進捗の集計対象から除外される(archived同様の除外)
describe("ProgressService.recalcProject — excludes cancelled child tickets (POS-3)", () => {
	it("averages only the non-cancelled child tickets when one of three is cancelled", async () => {
		const store = new IndexStore();
		const guard = new SelfWriteGuard();
		let capturedFm: Record<string, unknown> | undefined;
		const repo = makeRepo({
			updateFrontmatter: vi.fn().mockImplementation(async (_p: string, fn: (fm: Record<string, unknown>) => void) => {
				capturedFm = {};
				fn(capturedFm);
			}),
		});
		store.upsertEntity(makeEntity({ path: "project-a.md", type: "project", status: "active" }));
		store.upsertEntity(makeEntity({ path: "t1.md", status: "done", progress: 100, project: "project-a.md" }));
		store.upsertEntity(makeEntity({ path: "t2.md", status: "doing", progress: 50, project: "project-a.md" }));
		store.upsertEntity(makeEntity({ path: "t3.md", status: "cancelled", progress: 0, project: "project-a.md" }));
		const service = new ProgressService(repo, store, guard);

		// project pathを直接recalcAncestorsに渡し、recalcProjectのみを起動する(recalcTicketによるt1自身の
		// progress上書き(todos未設定=0%)を経由させず、集計除外そのものを検証する)。
		await service.recalcAncestors("project-a.md");

		// (100 + 50) / 2件(cancelledのt3を除外) = 75%。含めた場合は (100+50+0)/3=50%になるため、期待値の差で除外を検証する。
		expect(capturedFm?.progress).toBe(75);
	});
});
