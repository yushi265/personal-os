import { describe, expect, it, vi } from "vitest";
import { EntityService } from "../../src/services/EntityService";
import { IndexStore } from "../../src/infra/IndexStore";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import type { POSEventBus } from "../../src/infra/EventBus";
import type { POSSettings } from "../../src/settings/settings";
import { DEFAULT_SETTINGS } from "../../src/settings/settings";
import type { Entity } from "../../src/domain/entity";
import type { ProgressRecalculator } from "../../src/infra/types";

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Goals/goal-a.md",
		type: "goal",
		title: "goal-a",
		status: "active",
		tags: [],
		labels: [],
		extra: {},
		...overrides,
	};
}

function makeRepo(createdPath: string, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		readBody: vi.fn().mockResolvedValue(""),
		createEntityNote: vi.fn().mockResolvedValue({ path: createdPath, basename: createdPath.split("/").pop()!.replace(/\.md$/, "") }),
		hasBasenameCollision: vi.fn().mockReturnValue(false),
		...overrides,
	} as unknown as VaultRepository;
}

function makeEventBus() {
	return { emitEvent: vi.fn() } as unknown as POSEventBus;
}

const settings = DEFAULT_SETTINGS as POSSettings;

// design-ui-first.md起因バグ(F1 ②): 作成直後にmetadataCache "changed"を待たずIndexStoreへ即時反映されるか
describe("EntityService.create — optimistic IndexStore upsert (instant visibility fix)", () => {
	it("upserts the new entity into IndexStore synchronously after create, without waiting for metadataCache", async () => {
		const store = new IndexStore();
		const eventBus = makeEventBus();
		const repo = makeRepo("PersonalOS/Tickets/new-ticket.md");
		const service = new EntityService(repo, store, settings, undefined, undefined, eventBus);

		const file = await service.create({ type: "ticket", title: "new-ticket" });

		const entity = store.get(file.path);
		expect(entity).toBeDefined();
		expect(entity?.type).toBe("ticket");
		expect(entity?.title).toBe("new-ticket");
		expect(entity?.status).toBe("backlog");
		expect(eventBus.emitEvent).toHaveBeenCalledWith("index-updated", [file.path]);
	});

	it("resolves goal/project wikilinks to their real IndexStore paths (not the wikilink text)", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "PersonalOS/Goals/my-goal.md", type: "goal", title: "my-goal" }));
		store.upsertEntity(
			makeEntity({ path: "PersonalOS/Projects/my-project.md", type: "project", title: "my-project", status: "backlog" })
		);
		const eventBus = makeEventBus();
		const repo = makeRepo("PersonalOS/Tickets/new-ticket.md");
		const service = new EntityService(repo, store, settings, undefined, undefined, eventBus);

		const file = await service.create({
			type: "ticket",
			title: "new-ticket",
			goal: "PersonalOS/Goals/my-goal.md",
			project: "PersonalOS/Projects/my-project.md",
		});

		const entity = store.get(file.path);
		expect(entity?.goal).toBe("PersonalOS/Goals/my-goal.md");
		expect(entity?.project).toBe("PersonalOS/Projects/my-project.md");
	});

	it("does not throw or upsert when eventBus is not provided (optional dependency)", async () => {
		const store = new IndexStore();
		const repo = makeRepo("PersonalOS/Goals/new-goal.md");
		const service = new EntityService(repo, store, settings);

		const file = await service.create({ type: "goal", title: "new-goal" });

		expect(store.get(file.path)).toBeDefined();
	});
});

// バグ修正: 作成直後の二重書き込みによるfrontmatter破損(create → 即reindex → progress未設定とみなしたwriteBack)
describe("EntityService.create — initial progress: 0 avoids the create-then-writeback double write", () => {
	it("writes progress: 0 into the initial frontmatter for ticket/project types", async () => {
		const store = new IndexStore();
		const eventBus = makeEventBus();
		const repo = makeRepo("PersonalOS/Tickets/new-ticket.md");
		const service = new EntityService(repo, store, settings, undefined, undefined, eventBus);

		const file = await service.create({ type: "ticket", title: "new-ticket" });

		expect(repo.createEntityNote).toHaveBeenCalledWith("ticket", "new-ticket", expect.stringContaining("progress: 0"));
		expect(store.get(file.path)?.progress).toBe(0);
	});

	it("does not write a progress key for goal, which has no progress field", async () => {
		const store = new IndexStore();
		const repo = makeRepo("PersonalOS/Goals/new-goal.md");
		const service = new EntityService(repo, store, settings);

		await service.create({ type: "goal", title: "new-goal" });

		expect(repo.createEntityNote).toHaveBeenCalledWith("goal", "new-goal", expect.not.stringContaining("progress"));
	});
});

// バグ修正: 同basename(例: プロジェクト「てすと」とチケット「てすと」)が存在すると、basenameのみの
// wikilinkはgetFirstLinkpathDestで曖昧に解決され、誤ったtypeのファイルへ紐づいてしまう。
// 衝突がある場合はパス付きリンクを書いて曖昧さを排除する。
describe("EntityService.create — writes unambiguous parent links on basename collision", () => {
	it("writes a bare-title wikilink when there is no basename collision", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "PersonalOS/Projects/proj-a.md", type: "project", title: "proj-a" }));
		const repo = makeRepo("PersonalOS/Tickets/new-ticket.md", { hasBasenameCollision: vi.fn().mockReturnValue(false) });
		const service = new EntityService(repo, store, settings);

		await service.create({ type: "ticket", title: "new-ticket", project: "PersonalOS/Projects/proj-a.md" });

		expect(repo.createEntityNote).toHaveBeenCalledWith("ticket", "new-ticket", expect.stringContaining('project: "[[proj-a]]"'));
	});

	it("writes a path-qualified wikilink when the project title collides with another file's basename", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "PersonalOS/Projects/てすと.md", type: "project", title: "てすと" }));
		const hasBasenameCollision = vi.fn().mockReturnValue(true);
		const repo = makeRepo("PersonalOS/Tickets/new-ticket.md", { hasBasenameCollision });
		const service = new EntityService(repo, store, settings);

		const file = await service.create({ type: "ticket", title: "new-ticket", project: "PersonalOS/Projects/てすと.md" });

		expect(hasBasenameCollision).toHaveBeenCalledWith("てすと");
		expect(repo.createEntityNote).toHaveBeenCalledWith(
			"ticket",
			"new-ticket",
			expect.stringContaining('project: "[[PersonalOS/Projects/てすと]]"')
		);
		// 楽観的upsertも衝突時のパス付きリンクで正しくproject解決できること
		expect(store.get(file.path)?.project).toBe("PersonalOS/Projects/てすと.md");
	});
});

// POS-3 AC-6: cancelled遷移/離脱で親progressを再計算する(集計除外により親の値が変わるため)
describe("EntityService.changeStatus — progress recalc trigger (POS-3)", () => {
	function makeProgressService() {
		return { recalcAncestors: vi.fn().mockResolvedValue(undefined) } as unknown as ProgressRecalculator & {
			recalcAncestors: ReturnType<typeof vi.fn>;
		};
	}

	function makeStatusRepo() {
		return {
			updateFrontmatter: vi.fn().mockImplementation(async (_p: string, fn: (fm: Record<string, unknown>) => void) => fn({})),
		} as unknown as VaultRepository;
	}

	it("recalculates ancestors when a ticket moves to done (existing behavior)", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "t.md", type: "ticket", status: "doing" }));
		const progressService = makeProgressService();
		const service = new EntityService(makeStatusRepo(), store, settings, undefined, progressService);

		await service.changeStatus("t.md", "done");

		expect(progressService.recalcAncestors).toHaveBeenCalledWith("t.md");
	});

	it("recalculates ancestors when a ticket moves to cancelled", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "t.md", type: "ticket", status: "doing" }));
		const progressService = makeProgressService();
		const service = new EntityService(makeStatusRepo(), store, settings, undefined, progressService);

		await service.changeStatus("t.md", "cancelled");

		expect(progressService.recalcAncestors).toHaveBeenCalledWith("t.md");
	});

	it("recalculates ancestors when a ticket returns from cancelled to another status", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "t.md", type: "ticket", status: "cancelled" }));
		const progressService = makeProgressService();
		const service = new EntityService(makeStatusRepo(), store, settings, undefined, progressService);

		await service.changeStatus("t.md", "doing");

		expect(progressService.recalcAncestors).toHaveBeenCalledWith("t.md");
	});

	it("does not recalculate ancestors for a plain in-progress ticket status change", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "t.md", type: "ticket", status: "backlog" }));
		const progressService = makeProgressService();
		const service = new EntityService(makeStatusRepo(), store, settings, undefined, progressService);

		await service.changeStatus("t.md", "doing");

		expect(progressService.recalcAncestors).not.toHaveBeenCalled();
	});

	it("does not recalculate ancestors for a project status change (recalc trigger is ticket-only)", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "p.md", type: "project", status: "active" }));
		const progressService = makeProgressService();
		const service = new EntityService(makeStatusRepo(), store, settings, undefined, progressService);

		await service.changeStatus("p.md", "done");

		expect(progressService.recalcAncestors).not.toHaveBeenCalled();
	});
});
