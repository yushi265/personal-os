import { describe, expect, it } from "vitest";
import { evaluate, evaluateTodo, parseQuery } from "../../src/domain/query";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Tickets/ticket-a.md",
		type: "ticket",
		title: "銀行比較",
		status: "doing",
		tags: [],
		labels: [],
		blockers: [],
		extra: {},
		...overrides,
	};
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		filePath: "a.md",
		line: 0,
		text: "SBI銀行へ電話する",
		done: false,
		labels: [],
		parentType: "ticket",
		parentPath: "a.md",
		...overrides,
	};
}

describe("parseQuery", () => {
	it("splits key:value tokens from free text", () => {
		expect(parseQuery("type:ticket status:doing priority:high 銀行")).toEqual({
			filters: { type: "ticket", status: "doing", priority: "high" },
			text: "銀行",
		});
	});

	it("returns empty filters and text for an empty string", () => {
		expect(parseQuery("")).toEqual({ filters: {}, text: "" });
	});
});

describe("evaluate", () => {
	it("Q-1: type:ticket status:doing matches only when both conditions hold", () => {
		const q = parseQuery("type:ticket status:doing");
		expect(evaluate(q, makeEntity({ type: "ticket", status: "doing" }))).toBe(true);
		expect(evaluate(q, makeEntity({ type: "ticket", status: "backlog" }))).toBe(false);
		expect(evaluate(q, makeEntity({ type: "project", status: "doing" }))).toBe(false);
	});

	it("Q-2: due:<2026-07-10 matches 07-09 but not 07-10", () => {
		const q = parseQuery("due:<2026-07-10");
		expect(evaluate(q, makeEntity({ due: "2026-07-09" }))).toBe(true);
		expect(evaluate(q, makeEntity({ due: "2026-07-10" }))).toBe(false);
	});

	it("due:>2026-07-10 matches dates after the given date only", () => {
		const q = parseQuery("due:>2026-07-10");
		expect(evaluate(q, makeEntity({ due: "2026-07-11" }))).toBe(true);
		expect(evaluate(q, makeEntity({ due: "2026-07-10" }))).toBe(false);
	});

	it("Q-3: priority:high 銀行 requires both the filter and a title match", () => {
		const q = parseQuery("priority:high 銀行");
		expect(evaluate(q, makeEntity({ priority: "high", title: "銀行比較" }))).toBe(true);
		expect(evaluate(q, makeEntity({ priority: "high", title: "引っ越し準備" }))).toBe(false);
		expect(evaluate(q, makeEntity({ priority: "low", title: "銀行比較" }))).toBe(false);
	});

	it("Q-4: an empty query matches everything", () => {
		const q = parseQuery("");
		expect(evaluate(q, makeEntity())).toBe(true);
	});

	it("matches goal/project by resolved title (case-insensitive, partial)", () => {
		const q = parseQuery("goal:家族");
		expect(evaluate(q, makeEntity({ goal: "PersonalOS/Goals/goal-a.md" }), () => "家族")).toBe(true);
		expect(evaluate(q, makeEntity({ goal: "PersonalOS/Goals/goal-a.md" }), () => "仕事")).toBe(false);
	});
});

describe("evaluate - period filter", () => {
	const TODAY = "2026-07-04";

	it("PQ-1: period:today matches only entities due today", () => {
		const q = parseQuery("period:today");
		expect(evaluate(q, makeEntity({ due: "2026-07-04" }), undefined, TODAY)).toBe(true);
		expect(evaluate(q, makeEntity({ due: "2026-07-05" }), undefined, TODAY)).toBe(false);
	});

	it("PQ-2: period:week matches due dates from today through 7 days later (inclusive)", () => {
		const q = parseQuery("period:week");
		expect(evaluate(q, makeEntity({ due: "2026-07-04" }), undefined, TODAY)).toBe(true);
		expect(evaluate(q, makeEntity({ due: "2026-07-11" }), undefined, TODAY)).toBe(true);
		expect(evaluate(q, makeEntity({ due: "2026-07-12" }), undefined, TODAY)).toBe(false);
	});

	it("PQ-3: period:overdue matches the same as judge.isOverdue (open status required)", () => {
		const q = parseQuery("period:overdue");
		expect(evaluate(q, makeEntity({ due: "2026-07-01", status: "doing" }), undefined, TODAY)).toBe(true);
		expect(evaluate(q, makeEntity({ due: "2026-07-01", status: "done" }), undefined, TODAY)).toBe(false);
	});

	it("PQ-4: period:none matches only entities without a due date", () => {
		const q = parseQuery("period:none");
		expect(evaluate(q, makeEntity({ due: undefined }), undefined, TODAY)).toBe(true);
		expect(evaluate(q, makeEntity({ due: "2026-07-04" }), undefined, TODAY)).toBe(false);
	});
});

describe("evaluate - comma-separated OR filters", () => {
	it("PQ-5: status:doing,waiting matches either value", () => {
		const q = parseQuery("status:doing,waiting");
		expect(evaluate(q, makeEntity({ status: "doing" }))).toBe(true);
		expect(evaluate(q, makeEntity({ status: "waiting" }))).toBe(true);
		expect(evaluate(q, makeEntity({ status: "backlog" }))).toBe(false);
	});

	it("PQ-6: a single-value status query keeps its exact-match behavior (regression)", () => {
		const q = parseQuery("status:doing");
		expect(evaluate(q, makeEntity({ status: "doing" }))).toBe(true);
		expect(evaluate(q, makeEntity({ status: "waiting" }))).toBe(false);
	});
});

describe("evaluateTodo", () => {
	it("matches on priority/labels/due/text", () => {
		const q = parseQuery("priority:high labels:urgent 電話");
		expect(evaluateTodo(q, makeTodo({ priority: "high", labels: ["urgent"], text: "SBI銀行へ電話する" }))).toBe(true);
	});

	it("returns false when an Entity-only filter key is specified (avoids false positives)", () => {
		const q = parseQuery("status:doing");
		expect(evaluateTodo(q, makeTodo())).toBe(false);
	});

	it("returns true for an empty query", () => {
		expect(evaluateTodo(parseQuery(""), makeTodo())).toBe(true);
	});
});
