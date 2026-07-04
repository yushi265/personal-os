import { describe, expect, it } from "vitest";
import { isBlocked, isOverdue, isReviewNeeded, isTodoOverdue } from "../../src/domain/judge";
import type { Entity } from "../../src/domain/entity";
import type { Todo } from "../../src/domain/todo";

function makeEntity(overrides: Partial<Entity>): Entity {
	return {
		path: "PersonalOS/Tickets/ticket-a.md",
		type: "ticket",
		title: "ticket-a",
		status: "doing",
		tags: [],
		labels: [],
		blockers: [],
		extra: {},
		...overrides,
	};
}

function makeTodo(overrides: Partial<Todo>): Todo {
	return {
		filePath: "a.md",
		line: 0,
		text: "x",
		done: false,
		labels: [],
		parentType: "ticket",
		parentPath: "a.md",
		...overrides,
	};
}

describe("isOverdue", () => {
	it("J-1: due=yesterday, status=doing -> true", () => {
		expect(isOverdue(makeEntity({ due: "2026-07-03", status: "doing" }), "2026-07-04")).toBe(true);
	});

	it("J-2: due=yesterday, status=done -> false", () => {
		expect(isOverdue(makeEntity({ due: "2026-07-03", status: "done" }), "2026-07-04")).toBe(false);
	});

	it("J-3: due=today -> false (today is not overdue)", () => {
		expect(isOverdue(makeEntity({ due: "2026-07-04", status: "doing" }), "2026-07-04")).toBe(false);
	});
});

describe("isTodoOverdue", () => {
	it("returns true for an undone todo past its due date", () => {
		expect(isTodoOverdue(makeTodo({ dueDate: "2026-07-01" }), "2026-07-04")).toBe(true);
	});

	it("returns false for a done todo past its due date", () => {
		expect(isTodoOverdue(makeTodo({ dueDate: "2026-07-01", done: true }), "2026-07-04")).toBe(false);
	});

	it("returns false when there is no due date", () => {
		expect(isTodoOverdue(makeTodo({}), "2026-07-04")).toBe(false);
	});
});

describe("isReviewNeeded", () => {
	it("J-4: never reviewed, cycle=weekly -> true", () => {
		expect(isReviewNeeded(makeEntity({ reviewCycle: "weekly" }), "2026-07-04")).toBe(true);
	});

	it("J-5: last reviewed 8 days ago, cycle=weekly -> true", () => {
		expect(isReviewNeeded(makeEntity({ reviewCycle: "weekly", lastReviewed: "2026-06-26" }), "2026-07-04")).toBe(
			true
		);
	});

	it("J-6: last reviewed 6 days ago, cycle=weekly -> false", () => {
		expect(isReviewNeeded(makeEntity({ reviewCycle: "weekly", lastReviewed: "2026-06-28" }), "2026-07-04")).toBe(
			false
		);
	});

	it("J-8: month-end rollover, cycle=monthly, lastReviewed=1/31, today=3/02 -> true", () => {
		// 2024はうるう年(Feb=29日)。Jan 31 + 1month は繰り上がり仕様によりMar 2となる。
		expect(isReviewNeeded(makeEntity({ reviewCycle: "monthly", lastReviewed: "2024-01-31" }), "2024-03-02")).toBe(
			true
		);
	});

	it("returns false when no review_cycle is set", () => {
		expect(isReviewNeeded(makeEntity({}), "2026-07-04")).toBe(false);
	});
});

describe("isBlocked", () => {
	it("returns true when blockers exist and status is open", () => {
		expect(isBlocked(makeEntity({ blockers: ["waiting"], status: "waiting" }))).toBe(true);
	});

	it("J-7: blockers exist but status=archived -> false", () => {
		expect(isBlocked(makeEntity({ blockers: ["waiting"], status: "archived" }))).toBe(false);
	});

	it("returns false when there are no blockers", () => {
		expect(isBlocked(makeEntity({ blockers: [] }))).toBe(false);
	});

	it("returns false for entity types other than project/ticket", () => {
		expect(isBlocked(makeEntity({ type: "goal", status: "active", blockers: ["x"] }))).toBe(false);
	});
});
