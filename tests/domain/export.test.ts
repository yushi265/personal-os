import { describe, expect, it } from "vitest";
import { buildAiExport, buildAiSummary, type ExportSnapshot, type SummarySnapshot } from "../../src/domain/export";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";

function makeEntity(overrides: Partial<Entity>): Entity {
	return {
		path: "PersonalOS/x.md",
		type: "ticket",
		title: "x",
		status: "doing",
		tags: [],
		labels: [],
		extra: {},
		...overrides,
	};
}

function makeTodo(overrides: Partial<Todo>): Todo {
	return {
		filePath: "a.md",
		line: 0,
		text: "todo",
		done: false,
		labels: [],
		parentType: "ticket",
		parentPath: "a.md",
		...overrides,
	};
}

function emptySnapshot(overrides: Partial<ExportSnapshot> = {}): ExportSnapshot {
	return {
		today: "2026-07-04",
		goals: [],
		unlinked: [],
		overdue: [],
		reviewNeeded: [],
		...overrides,
	};
}

describe("buildAiExport", () => {
	it("emits the header with today's date", () => {
		const output = buildAiExport(emptySnapshot());
		expect(output).toContain("# Personal OS Context (2026-07-04)");
	});

	it("renders an empty vault (0 goals) without breaking", () => {
		const output = buildAiExport(emptySnapshot());
		expect(output).toContain("## Goals");
		expect(output).toContain("(該当なし)");
	});

	it("renders Goal -> Project -> Ticket -> Todo depth-first with correct heading levels and order", () => {
		const goal = makeEntity({ path: "g", type: "goal", title: "家族", status: "active", priority: "high" });
		const project = makeEntity({
			path: "p",
			type: "project",
			title: "住宅購入",
			status: "active",
			progress: 40,
		});
		const ticket = makeEntity({
			path: "t",
			type: "ticket",
			title: "住宅ローン比較",
			status: "doing",
			progress: 20,
		});
		const todo = makeTodo({ text: "比較表を作る", dueDate: "2026-07-10", parentPath: "t" });

		const snapshot = emptySnapshot({
			goals: [
				{
					goal,
					projects: [
						{
							project,
							tickets: [{ ticket, todos: [todo] }],
							directTodos: [],
						},
					],
				},
			],
		});

		const output = buildAiExport(snapshot);
		const goalIdx = output.indexOf("### 家族 (active, priority: high)");
		const projectIdx = output.indexOf("#### 住宅購入 (active, progress: 40%, due: -)");
		const ticketIdx = output.indexOf("##### 住宅ローン比較 (doing, progress: 20%)");
		const todoIdx = output.indexOf("- [ ] 比較表を作る 📅 2026-07-10");

		expect(goalIdx).toBeGreaterThan(-1);
		expect(projectIdx).toBeGreaterThan(goalIdx);
		expect(ticketIdx).toBeGreaterThan(projectIdx);
		expect(todoIdx).toBeGreaterThan(ticketIdx);
	});

	it("renders a cancelled todo with the [-] checkbox, preserving cancellation info", () => {
		const goal = makeEntity({ path: "g", type: "goal", title: "家族", status: "active" });
		const project = makeEntity({ path: "p", type: "project", title: "住宅購入", status: "active" });
		const ticket = makeEntity({ path: "t", type: "ticket", title: "住宅ローン比較", status: "cancelled" });
		const todo = makeTodo({ text: "銀行に電話する", statusChar: "-", parentPath: "t" });

		const snapshot = emptySnapshot({
			goals: [
				{
					goal,
					projects: [
						{
							project,
							tickets: [{ ticket, todos: [todo] }],
							directTodos: [],
						},
					],
				},
			],
		});

		const output = buildAiExport(snapshot);
		expect(output).toContain("- [-] 銀行に電話する");
	});

	it("puts orphaned entities into the Unlinked section", () => {
		const orphanProject = makeEntity({ path: "op", type: "project", title: "孤立プロジェクト", status: "backlog" });
		const snapshot = emptySnapshot({ unlinked: [{ entity: orphanProject }] });
		const output = buildAiExport(snapshot);
		expect(output).toContain("## Unlinked");
		expect(output).toContain("- [project] 孤立プロジェクト (backlog)");
	});

	it("extracts Overdue / Review Needed sections", () => {
		const snapshot = emptySnapshot({
			overdue: [
				{ title: "SBI銀行へ電話する", due: "2026-07-01", kind: "todo", parentTitle: "住宅ローン比較" },
				{ title: "住宅購入", due: "2026-06-30", kind: "entity" },
			],
			reviewNeeded: [{ title: "住宅購入", cycle: "weekly", lastReviewed: "2026-06-20" }],
		});
		const output = buildAiExport(snapshot);
		expect(output).toContain("## Overdue");
		expect(output).toContain("- [ ] SBI銀行へ電話する 📅 2026-07-01 (住宅ローン比較)");
		expect(output).toContain("- 住宅購入 📅 2026-06-30");
		expect(output).toContain("## Review Needed");
		expect(output).toContain("- 住宅購入 (weekly, last: 2026-06-20)");
	});
});

describe("buildAiSummary", () => {
	function emptySummary(overrides: Partial<SummarySnapshot> = {}): SummarySnapshot {
		return {
			today: "2026-07-04",
			activeProjectsCount: 0,
			doingTicketsCount: 0,
			openTodoCount: 0,
			overdue: [],
			reviewNeeded: [],
			...overrides,
		};
	}

	it("emits the header and counts line", () => {
		const output = buildAiSummary(
			emptySummary({ activeProjectsCount: 3, doingTicketsCount: 5, openTodoCount: 24 })
		);
		expect(output).toContain("# Personal OS Summary (2026-07-04)");
		expect(output).toContain("- Active Projects: 3 / Tickets(doing): 5 / 未完了Todo: 24");
	});

	it("formats the Overdue / Review Needed digest lines with counts", () => {
		const output = buildAiSummary(
			emptySummary({
				overdue: [{ title: "比較表を作る", due: "2026-07-01", kind: "todo" }],
				reviewNeeded: [{ title: "住宅購入", cycle: "weekly", lastReviewed: "2026-06-20" }],
			})
		);
		expect(output).toContain("- ⚠ Overdue: 1件(比較表を作る 📅2026-07-01)");
		expect(output).toContain("- 🔍 Review Needed: 1件(住宅購入: weekly, last 2026-06-20)");
	});

	it("renders zero counts without breaking", () => {
		const output = buildAiSummary(emptySummary());
		expect(output).toContain("- ⚠ Overdue: 0件(なし)");
		expect(output).toContain("- 🔍 Review Needed: 0件(なし)");
	});
});
