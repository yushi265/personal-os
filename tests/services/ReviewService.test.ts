import { describe, expect, it, vi } from "vitest";
import { ReviewService } from "../../src/services/ReviewService";
import type { Entity } from "../../src/domain/entity";
import { IndexStore } from "../../src/infra/IndexStore";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import type { ActivityLogger } from "../../src/infra/types";

const REVIEWS_FOLDER = "PersonalOS/Reviews";

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Projects/proj-a.md",
		type: "project",
		title: "proj-a",
		status: "active",
		tags: [],
		labels: [],
		extra: {},
		...overrides,
	};
}

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		getEntityFolder: vi.fn().mockReturnValue(REVIEWS_FOLDER),
		getFile: vi.fn().mockReturnValue(null),
		createNoteAt: vi.fn().mockResolvedValue({ path: "created.md" }),
		updateFrontmatter: vi.fn().mockResolvedValue(undefined),
		...overrides,
	} as unknown as VaultRepository;
}

function makeActivityLog() {
	return { log: vi.fn().mockResolvedValue(undefined) } as unknown as ActivityLogger;
}

const INPUT_BASE = {
	cycle: "weekly" as const,
	progress: "順調",
	blocker: "なし",
	nextAction: "見積もりを取る",
};

describe("ReviewService.submitReview", () => {
	it("creates a review note named {title}-{today}.md", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const service = new ReviewService(repo, store, makeActivityLog());

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Projects/proj-a.md", decision: "continue" });

		const [path, body] = (repo.createNoteAt as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(path).toMatch(new RegExp(`^${REVIEWS_FOLDER}/proj-a-\\d{4}-\\d{2}-\\d{2}\\.md$`));
		expect(body).toContain("type: review");
		expect(body).toContain("## Progress");
		expect(body).toContain("## Blocker");
		expect(body).toContain("## Next Action");
	});

	it("appends -2/-3 suffixes when a same-day review note already exists", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		// 1回目・2回目のパスは既存とみなし、3回目でようやく空きが見つかる想定
		const getFile = vi.fn().mockReturnValueOnce({ path: "x" }).mockReturnValueOnce({ path: "y" }).mockReturnValue(null);
		const repo = makeRepo({ getFile });
		const service = new ReviewService(repo, store, makeActivityLog());

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Projects/proj-a.md", decision: "continue" });

		const [path] = (repo.createNoteAt as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(path).toMatch(new RegExp(`^${REVIEWS_FOLDER}/proj-a-\\d{4}-\\d{2}-\\d{2}-3\\.md$`));
	});

	it("updates last_reviewed on the target entity", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const service = new ReviewService(repo, store, makeActivityLog());

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Projects/proj-a.md", decision: "continue" });

		const call = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls.find(
			([path]) => path === "PersonalOS/Projects/proj-a.md"
		);
		expect(call).toBeDefined();
		const fn = call![1] as (fm: Record<string, unknown>) => void;
		const fm: Record<string, unknown> = {};
		fn(fm);
		expect(fm.last_reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("decision=continue does not change status", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ status: "active" }));
		const repo = makeRepo();
		const service = new ReviewService(repo, store, makeActivityLog());

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Projects/proj-a.md", decision: "continue" });

		// last_reviewed更新の1回のみ。status変更呼び出しはない
		expect(repo.updateFrontmatter).toHaveBeenCalledTimes(1);
	});

	it("decision=pause sets project status to waiting", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ type: "project", status: "active" }));
		const repo = makeRepo();
		const service = new ReviewService(repo, store, makeActivityLog());

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Projects/proj-a.md", decision: "pause" });

		const statusCall = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[1];
		const fm: Record<string, unknown> = { status: "active" };
		(statusCall[1] as (fm: Record<string, unknown>) => void)(fm);
		expect(fm.status).toBe("waiting");
	});

	it("decision=pause sets goal status to paused", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "PersonalOS/Goals/goal-a.md", type: "goal", status: "active" }));
		const repo = makeRepo();
		const service = new ReviewService(repo, store, makeActivityLog());

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Goals/goal-a.md", decision: "pause" });

		const statusCall = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[1];
		const fm: Record<string, unknown> = { status: "active" };
		(statusCall[1] as (fm: Record<string, unknown>) => void)(fm);
		expect(fm.status).toBe("paused");
	});

	it("decision=complete sets status to done", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ type: "ticket", status: "doing" }));
		const repo = makeRepo();
		const service = new ReviewService(repo, store, makeActivityLog());

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Projects/proj-a.md", decision: "complete" });

		const statusCall = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[1];
		const fm: Record<string, unknown> = { status: "doing" };
		(statusCall[1] as (fm: Record<string, unknown>) => void)(fm);
		expect(fm.status).toBe("done");
	});

	it("records an activity log entry with the decision", async () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity());
		const repo = makeRepo();
		const activityLog = makeActivityLog();
		const service = new ReviewService(repo, store, activityLog);

		await service.submitReview({ ...INPUT_BASE, targetPath: "PersonalOS/Projects/proj-a.md", decision: "complete" });

		expect(activityLog.log).toHaveBeenCalledWith("review", expect.stringContaining("proj-a"));
	});
});
