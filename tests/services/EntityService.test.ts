import { describe, expect, it, vi } from "vitest";
import { EntityService } from "../../src/services/EntityService";
import { IndexStore } from "../../src/infra/IndexStore";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import type { POSEventBus } from "../../src/infra/EventBus";
import type { POSSettings } from "../../src/settings/settings";
import { DEFAULT_SETTINGS } from "../../src/settings/settings";
import type { Entity } from "../../src/domain/entity";

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Goals/goal-a.md",
		type: "goal",
		title: "goal-a",
		status: "active",
		tags: [],
		labels: [],
		blockers: [],
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
