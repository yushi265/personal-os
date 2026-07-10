import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, fillKanbanColumnNames } from "../../src/settings/settings";

describe("fillKanbanColumnNames (POS-3 AC-10)", () => {
	it("[代表値] ticketにcancelledキー無し → 既定 \"Cancelled\" が補完される", () => {
		const saved = {
			project: { ...DEFAULT_SETTINGS.kanbanColumnNames.project },
			ticket: {
				backlog: "Backlog",
				ready: "Ready",
				doing: "Doing",
				waiting: "Waiting",
				review: "Review",
				done: "Done",
				archived: "Archived",
			},
		} as typeof DEFAULT_SETTINGS.kanbanColumnNames;

		const result = fillKanbanColumnNames(saved, DEFAULT_SETTINGS.kanbanColumnNames);

		expect(result.ticket.cancelled).toBe("Cancelled");
	});

	it("[代表値] 既存キー done: \"完了\"(カスタム名) は温存される", () => {
		const saved = {
			project: { ...DEFAULT_SETTINGS.kanbanColumnNames.project },
			ticket: {
				backlog: "Backlog",
				ready: "Ready",
				doing: "Doing",
				waiting: "Waiting",
				review: "Review",
				done: "完了",
				archived: "Archived",
			},
		} as typeof DEFAULT_SETTINGS.kanbanColumnNames;

		const result = fillKanbanColumnNames(saved, DEFAULT_SETTINGS.kanbanColumnNames);

		expect(result.ticket.done).toBe("完了");
		expect(result.ticket.cancelled).toBe("Cancelled");
	});

	it("[境界値] savedが空オブジェクト → 全キーが既定値で補完される", () => {
		const saved = { project: {}, ticket: {} } as unknown as typeof DEFAULT_SETTINGS.kanbanColumnNames;

		const result = fillKanbanColumnNames(saved, DEFAULT_SETTINGS.kanbanColumnNames);

		expect(result).toEqual(DEFAULT_SETTINGS.kanbanColumnNames);
	});

	it("[境界値] savedが全キー保持 → 変更なし(同値を返す)", () => {
		const saved = {
			project: { ...DEFAULT_SETTINGS.kanbanColumnNames.project },
			ticket: { ...DEFAULT_SETTINGS.kanbanColumnNames.ticket, done: "完了" },
		};

		const result = fillKanbanColumnNames(saved, DEFAULT_SETTINGS.kanbanColumnNames);

		expect(result).toEqual(saved);
	});
});
