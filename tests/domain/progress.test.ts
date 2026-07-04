import { describe, expect, it } from "vitest";
import { calcProjectProgress, calcTicketProgress } from "../../src/domain/progress";
import type { Todo } from "../../src/domain/todo";

function makeTodo(done: boolean): Todo {
	return {
		filePath: "a.md",
		line: 0,
		text: "x",
		done,
		labels: [],
		parentType: "ticket",
		parentPath: "a.md",
	};
}

describe("calcTicketProgress", () => {
	it("P-1: returns 0 for an empty todo list", () => {
		expect(calcTicketProgress([])).toBe(0);
	});

	it("P-2: rounds 1/3 done to 33", () => {
		expect(calcTicketProgress([makeTodo(true), makeTodo(false), makeTodo(false)])).toBe(33);
	});

	it("P-3: rounds 2/3 done to 67", () => {
		expect(calcTicketProgress([makeTodo(true), makeTodo(true), makeTodo(false)])).toBe(67);
	});
});

describe("calcProjectProgress", () => {
	it("P-4: averages ticket progresses with no direct todos", () => {
		expect(calcProjectProgress([100, 0], [])).toBe(50);
	});

	it("P-5: treats direct todos as one ticket-equivalent in the average", () => {
		expect(calcProjectProgress([100], [makeTodo(true), makeTodo(false)])).toBe(75);
	});

	it("P-6: returns 0 when there are no tickets and no direct todos", () => {
		expect(calcProjectProgress([], [])).toBe(0);
	});
});
