import { describe, expect, it, vi, beforeEach } from "vitest";
import { PromoteConflictError, PromoteService } from "../../src/services/PromoteService";
import type { Todo } from "../../src/domain/todo";
import type { Entity } from "../../src/domain/entity";
import { IndexStore } from "../../src/infra/IndexStore";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import type { EntityService } from "../../src/services/EntityService";
import type { ActivityLogger } from "../../src/infra/types";

const TODO: Todo = {
	filePath: "PersonalOS/Projects/proj-a.md",
	line: 5,
	text: "SBI銀行へ電話する",
	rawText: "SBI銀行へ電話する 📅 2026-07-10",
	done: false,
	dueDate: "2026-07-10",
	labels: [],
	parentType: "project",
	parentPath: "PersonalOS/Projects/proj-a.md",
};

const EXPECTED_LINE = "- [ ] SBI銀行へ電話する 📅 2026-07-10";
const CREATED_PATH = "PersonalOS/Tickets/SBI銀行へ電話する.md";

function makeProjectEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Projects/proj-a.md",
		type: "project",
		title: "proj-a",
		status: "active",
		goal: "PersonalOS/Goals/goal-a.md",
		tags: [],
		labels: [],
		blockers: [],
		extra: {},
		...overrides,
	};
}

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		processBody: vi.fn().mockResolvedValue(undefined),
		editLine: vi.fn().mockResolvedValue("ok"),
		trash: vi.fn().mockResolvedValue(undefined),
		moveToFolder: vi.fn().mockResolvedValue("PersonalOS/Projects/ticket-a.md"),
		updateFrontmatter: vi.fn().mockResolvedValue(undefined),
		getEntityFolder: vi.fn().mockReturnValue("PersonalOS/Projects"),
		...overrides,
	} as unknown as VaultRepository;
}

function makeEntityService(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		create: vi.fn().mockResolvedValue({ path: CREATED_PATH }),
		...overrides,
	} as unknown as EntityService;
}

function makeActivityLog() {
	return { log: vi.fn().mockResolvedValue(undefined) } as unknown as ActivityLogger;
}

describe("PromoteService.promoteTodoToTicket", () => {
	let store: IndexStore;

	beforeEach(() => {
		store = new IndexStore();
		store.upsertEntity(makeProjectEntity());
	});

	it("deletes the source todo line when sourceAction is 'delete'", async () => {
		const repo = makeRepo();
		const entityService = makeEntityService();
		const activityLog = makeActivityLog();
		const service = new PromoteService(repo, store, entityService, activityLog);

		await service.promoteTodoToTicket(TODO, {
			newTitle: "SBI銀行へ電話する",
			projectPath: "PersonalOS/Projects/proj-a.md",
			sourceAction: "delete",
		});

		expect(entityService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "ticket",
				title: "SBI銀行へ電話する",
				project: "PersonalOS/Projects/proj-a.md",
				goal: "PersonalOS/Goals/goal-a.md",
			})
		);
		expect(repo.processBody).toHaveBeenCalledWith(CREATED_PATH, expect.any(Function));
		expect(repo.editLine).toHaveBeenCalledWith(TODO.filePath, TODO.line, EXPECTED_LINE, null);
		expect(repo.trash).not.toHaveBeenCalled();
		expect(activityLog.log).toHaveBeenCalledWith("promote", expect.stringContaining("SBI銀行へ電話する"));
	});

	it("toggles the source todo done when sourceAction is 'complete'", async () => {
		const repo = makeRepo();
		const service = new PromoteService(repo, store, makeEntityService(), makeActivityLog());

		await service.promoteTodoToTicket(TODO, {
			newTitle: "SBI銀行へ電話する",
			projectPath: "PersonalOS/Projects/proj-a.md",
			sourceAction: "complete",
		});

		expect(repo.editLine).toHaveBeenCalledWith(
			TODO.filePath,
			TODO.line,
			EXPECTED_LINE,
			expect.stringMatching(/^- \[x\] SBI銀行へ電話する 📅 2026-07-10 ✅ \d{4}-\d{2}-\d{2}$/)
		);
	});

	it("replaces the source todo line with a wikilink when sourceAction is 'link'", async () => {
		const repo = makeRepo();
		const service = new PromoteService(repo, store, makeEntityService(), makeActivityLog());

		await service.promoteTodoToTicket(TODO, {
			newTitle: "SBI銀行へ電話する",
			projectPath: "PersonalOS/Projects/proj-a.md",
			sourceAction: "link",
		});

		expect(repo.editLine).toHaveBeenCalledWith(
			TODO.filePath,
			TODO.line,
			EXPECTED_LINE,
			"- [ ] [[SBI銀行へ電話する]]"
		);
	});

	it("rolls back (trashes the created ticket) when the source line no longer matches", async () => {
		const repo = makeRepo({ editLine: vi.fn().mockResolvedValue("line-mismatch") });
		const entityService = makeEntityService();
		const activityLog = makeActivityLog();
		const service = new PromoteService(repo, store, entityService, activityLog);

		await expect(
			service.promoteTodoToTicket(TODO, {
				newTitle: "SBI銀行へ電話する",
				projectPath: "PersonalOS/Projects/proj-a.md",
				sourceAction: "delete",
			})
		).rejects.toBeInstanceOf(PromoteConflictError);

		expect(repo.trash).toHaveBeenCalledWith(CREATED_PATH);
		expect(activityLog.log).not.toHaveBeenCalled();
	});

	it("rolls back (trashes the created ticket) when moving the todo body fails", async () => {
		const repo = makeRepo({ processBody: vi.fn().mockRejectedValue(new Error("boom")) });
		const entityService = makeEntityService();
		const activityLog = makeActivityLog();
		const service = new PromoteService(repo, store, entityService, activityLog);

		await expect(
			service.promoteTodoToTicket(TODO, {
				newTitle: "SBI銀行へ電話する",
				projectPath: "PersonalOS/Projects/proj-a.md",
				sourceAction: "delete",
			})
		).rejects.toThrow("boom");

		expect(repo.trash).toHaveBeenCalledWith(CREATED_PATH);
		expect(activityLog.log).not.toHaveBeenCalled();
	});
});

describe("PromoteService.promoteTicketToProject", () => {
	it("moves the ticket note into Projects/ and rewrites its frontmatter", async () => {
		const store = new IndexStore();
		store.upsertEntity({
			path: "PersonalOS/Tickets/ticket-a.md",
			type: "ticket",
			title: "ticket-a",
			status: "doing",
			goal: "PersonalOS/Goals/goal-a.md",
			project: "PersonalOS/Projects/proj-a.md",
			tags: [],
			labels: [],
			blockers: [],
			extra: {},
		});
		const repo = makeRepo();
		const activityLog = makeActivityLog();
		const service = new PromoteService(repo, store, makeEntityService(), activityLog);

		await service.promoteTicketToProject("PersonalOS/Tickets/ticket-a.md");

		expect(repo.moveToFolder).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md", "PersonalOS/Projects");
		expect(repo.updateFrontmatter).toHaveBeenCalledWith("PersonalOS/Projects/ticket-a.md", expect.any(Function));

		const fn = (repo.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
			fm: Record<string, unknown>
		) => void;
		const fm: Record<string, unknown> = { type: "ticket", status: "doing", project: "[[proj-a]]" };
		fn(fm);
		expect(fm.type).toBe("project");
		expect(fm.status).toBe("backlog");
		expect(fm.project).toBeUndefined();

		expect(activityLog.log).toHaveBeenCalledWith("promote", expect.stringContaining("ticket-a"));
	});
});
