import { describe, expect, it, vi } from "vitest";
import { ExportService } from "../../src/services/ExportService";
import { IndexStore } from "../../src/infra/IndexStore";
import type { Todo } from "../../src/domain/todo";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		filePath: "PersonalOS/Tickets/ticket-a.md",
		line: 0,
		text: "todo",
		done: false,
		labels: [],
		parentType: "ticket",
		parentPath: "PersonalOS/Tickets/ticket-a.md",
		...overrides,
	};
}

// POS-3 AC-7: AI Summaryの「未完了Todo」件数はcancelledを残作業として数えない
describe("ExportService.exportAiSummary — openTodoCount excludes cancelled todos (POS-3)", () => {
	it("does not count a cancelled todo toward the open todo count", async () => {
		const store = new IndexStore();
		store.setTodos("PersonalOS/Tickets/ticket-a.md", [
			makeTodo({ line: 1, text: "open" }),
			makeTodo({ line: 2, text: "cancelled", statusChar: "-" }),
		]);
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { clipboard: { writeText } });
		const service = new ExportService(store);

		await service.exportAiSummary();

		expect(writeText).toHaveBeenCalledTimes(1);
		const text = writeText.mock.calls[0][0] as string;
		expect(text).toContain("未完了Todo: 1");

		vi.unstubAllGlobals();
	});
});
