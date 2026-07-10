import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndexStore } from "../../../src/infra/IndexStore";
import type { Todo } from "../../../src/domain/todo";
import type PersonalOSPlugin from "../../../src/main";
import { buildDashboardData } from "../../../src/ui/dashboard/dashboardData";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		filePath: "PersonalOS/Tickets/t1.md",
		line: 0,
		text: "do it",
		done: false,
		labels: [],
		parentType: "ticket",
		parentPath: "PersonalOS/Tickets/t1.md",
		...overrides,
	};
}

/**
 * TodoService.list()のdone/dueOnフィルタのみを再現した最小mock(cancelled除外はTodoService側の
 * 責務ではないため、この時点ではcancelledを素通りさせる=実運用のTodoService.listと同じ挙動)。
 */
function makePlugin(store: IndexStore): PersonalOSPlugin {
	return {
		store,
		capability: { todoFeatures: true },
		todoService: {
			list: (filter: { done?: boolean; dueOn?: string }) =>
				store.getAllTodos().filter((t) => {
					if (filter.done !== undefined && t.done !== filter.done) return false;
					if (filter.dueOn !== undefined && !(t.dueDate && t.dueDate <= filter.dueOn)) return false;
					return true;
				}),
		},
		repo: {
			getFile: () => null,
			readBody: async () => "",
		},
		settings: {
			rootDirectory: "PersonalOS",
			folders: { logs: "Logs" },
			dashboard: { recentUpdatesCount: 10 },
		},
	} as unknown as PersonalOSPlugin;
}

describe("buildDashboardData cancelled exclusion (POS-3 AC-7)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 10)); // 2026-07-10 local
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("excludes a cancelled todo due today from todayTodos and openTodosCount", async () => {
		const store = new IndexStore();
		store.setTodos("t1.md", [
			makeTodo({ filePath: "t1.md", parentPath: "t1.md", line: 0, dueDate: "2026-07-10", statusChar: "-" }),
			makeTodo({ filePath: "t1.md", parentPath: "t1.md", line: 1, dueDate: "2026-07-10" }),
		]);
		const plugin = makePlugin(store);

		const data = await buildDashboardData(plugin);

		expect(data.todayTodos.map((t) => t.line)).toEqual([1]);
		expect(data.openTodosCount).toBe(1);
	});
});
