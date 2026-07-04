import { describe, expect, it, vi } from "vitest";
import { TodoService } from "../../src/services/TodoService";
import type { Todo } from "../../src/domain/todo";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import type { IndexStore } from "../../src/infra/IndexStore";
import type { Indexer } from "../../src/infra/Indexer";
import type { POSSettings } from "../../src/settings/settings";

const TODO: Todo = {
	filePath: "PersonalOS/Tickets/ticket-a.md",
	line: 3,
	text: "牛乳を買う",
	rawText: "牛乳を買う 📅 2026-07-10 [priority:: medium]",
	done: false,
	dueDate: "2026-07-10",
	priority: "medium",
	labels: [],
	parentType: "ticket",
	parentPath: "PersonalOS/Tickets/ticket-a.md",
};

const EXPECTED_LINE = "- [ ] 牛乳を買う 📅 2026-07-10 [priority:: medium]";

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		editLine: vi.fn().mockResolvedValue("ok"),
		getFile: vi.fn().mockReturnValue(null),
		...overrides,
	} as unknown as VaultRepository;
}

function makeIndexer() {
	return { reindexFile: vi.fn().mockResolvedValue(undefined) } as unknown as Indexer;
}

function makeSettings(): POSSettings {
	return {
		rootDirectory: "PersonalOS",
		folders: {
			goals: "Goals",
			projects: "Projects",
			tickets: "Tickets",
			inbox: "Inbox",
			archive: "Archive",
			templates: "Templates",
			reviews: "Reviews",
			logs: "Logs",
		},
	} as unknown as POSSettings;
}

describe("TodoService.updateInline", () => {
	it("rebuilds the expected line from the todo and writes the patched next line via editLine", async () => {
		const repo = makeRepo();
		const service = new TodoService(repo, {} as IndexStore, makeSettings(), makeIndexer());

		await service.updateInline(TODO, { text: "牛乳とパンを買う" });

		expect(repo.editLine).toHaveBeenCalledWith(
			TODO.filePath,
			TODO.line,
			EXPECTED_LINE,
			"- [ ] 牛乳とパンを買う 📅 2026-07-10 [priority:: medium]"
		);
	});

	it("removes the due emoji when patch.dueDate is null", async () => {
		const repo = makeRepo();
		const service = new TodoService(repo, {} as IndexStore, makeSettings(), makeIndexer());

		await service.updateInline(TODO, { dueDate: null });

		expect(repo.editLine).toHaveBeenCalledWith(
			TODO.filePath,
			TODO.line,
			EXPECTED_LINE,
			"- [ ] 牛乳を買う [priority:: medium]"
		);
	});

	it("removes the priority inline field when patch.priority is null", async () => {
		const repo = makeRepo();
		const service = new TodoService(repo, {} as IndexStore, makeSettings(), makeIndexer());

		await service.updateInline(TODO, { priority: null });

		expect(repo.editLine).toHaveBeenCalledWith(TODO.filePath, TODO.line, EXPECTED_LINE, "- [ ] 牛乳を買う 📅 2026-07-10");
	});

	it("re-indexes the file and shows E003 on a line mismatch, following the existing toggle/remove flow", async () => {
		const indexer = makeIndexer();
		const file = { path: TODO.filePath };
		const repo = makeRepo({ editLine: vi.fn().mockResolvedValue("line-mismatch"), getFile: vi.fn().mockReturnValue(file) });
		const service = new TodoService(repo, {} as IndexStore, makeSettings(), indexer);

		await service.updateInline(TODO, { text: "changed" });

		expect(indexer.reindexFile).toHaveBeenCalledWith(file);
	});
});
