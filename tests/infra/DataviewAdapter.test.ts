import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { DataviewAdapter } from "../../src/infra/DataviewAdapter";
import { IndexStore } from "../../src/infra/IndexStore";
import type { STask } from "../../src/infra/dataview-types";

/** dataview pluginのAPIをtask一覧のみモックする最小App */
function makeApp(tasks: STask[]): App {
	const api = {
		page: (_path: string) => ({ file: { tasks: { values: tasks } } }),
	};
	return {
		plugins: { plugins: { dataview: { api } } },
	} as unknown as App;
}

function makeTask(overrides: Partial<STask>): STask {
	return { line: 0, text: "todo", completed: false, ...overrides };
}

describe("DataviewAdapter.toTodo — checkbox status char (POS-3 AC-4)", () => {
	it("[同値分割] status \"-\" → statusChar \"-\"・done false", async () => {
		const app = makeApp([makeTask({ status: "-", completed: false })]);
		const adapter = new DataviewAdapter(app, new IndexStore());

		const todos = await adapter.getTodos("PersonalOS/Tickets/a.md");

		expect(todos[0].statusChar).toBe("-");
		expect(todos[0].done).toBe(false);
	});

	it("[同値分割] status \"x\"・completed=true → statusChar \"x\"・done true", async () => {
		const app = makeApp([makeTask({ status: "x", completed: true })]);
		const adapter = new DataviewAdapter(app, new IndexStore());

		const todos = await adapter.getTodos("PersonalOS/Tickets/a.md");

		expect(todos[0].statusChar).toBe("x");
		expect(todos[0].done).toBe(true);
	});

	it("[同値分割] status \" \" → statusChar \" \"・done false(open)", async () => {
		const app = makeApp([makeTask({ status: " ", completed: false })]);
		const adapter = new DataviewAdapter(app, new IndexStore());

		const todos = await adapter.getTodos("PersonalOS/Tickets/a.md");

		expect(todos[0].statusChar).toBe(" ");
		expect(todos[0].done).toBe(false);
	});

	it("[代表値] status欠落・completed=true → statusChar \"x\"にフォールバック(旧版Dataview)", async () => {
		const task = makeTask({ completed: true });
		delete task.status;
		const app = makeApp([task]);
		const adapter = new DataviewAdapter(app, new IndexStore());

		const todos = await adapter.getTodos("PersonalOS/Tickets/a.md");

		expect(todos[0].statusChar).toBe("x");
		expect(todos[0].done).toBe(true);
	});

	it("[代表値] status \"-\" かつ completed=true(矛盾入力) → done は false に正規化", async () => {
		const app = makeApp([makeTask({ status: "-", completed: true })]);
		const adapter = new DataviewAdapter(app, new IndexStore());

		const todos = await adapter.getTodos("PersonalOS/Tickets/a.md");

		expect(todos[0].statusChar).toBe("-");
		expect(todos[0].done).toBe(false);
	});
});
