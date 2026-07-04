import { describe, expect, it } from "vitest";
import {
	buildTodoLine,
	extractEmojiDate,
	extractInline,
	extractInlineList,
	normalizePriority,
	rebuildTodoLine,
	stripMetadata,
	toggleTodoLine,
	type Todo,
} from "../../src/domain/todo";

describe("toggleTodoLine", () => {
	it("T-1: marks an open todo done and appends the done-emoji date", () => {
		const result = toggleTodoLine("- [ ] test 📅 2026-07-10", "2026-07-04");
		expect(result).toBe("- [x] test 📅 2026-07-10 ✅ 2026-07-04");
	});

	it("T-2: marks a done todo open and removes the done-emoji date", () => {
		const result = toggleTodoLine("- [x] test ✅ 2026-07-01", "2026-07-04");
		expect(result).toBe("- [ ] test");
	});

	it("T-3: preserves leading indentation for a nested todo", () => {
		const result = toggleTodoLine("  - [ ] sub", "2026-07-04");
		expect(result).toBe("  - [x] sub ✅ 2026-07-04");
	});

	it("round-trips back to the original line when toggled twice", () => {
		const original = "- [ ] test 📅 2026-07-10";
		const toggled = toggleTodoLine(original, "2026-07-04");
		const restored = toggleTodoLine(toggled, "2026-07-05");
		expect(restored).toBe(original);
	});
});

describe("stripMetadata", () => {
	it("removes emoji dates and inline fields, collapsing extra whitespace", () => {
		expect(stripMetadata("buy milk 📅 2026-07-10 [priority:: high]")).toBe("buy milk");
	});

	it("removes multiple emoji dates and a labels inline field", () => {
		expect(stripMetadata("do it 🛫 2026-07-01 📅 2026-07-10 [labels:: home, urgent]")).toBe("do it");
	});

	it("returns trimmed text unchanged when no metadata is present", () => {
		expect(stripMetadata("  plain todo  ")).toBe("plain todo");
	});
});

describe("extractEmojiDate", () => {
	it("extracts the due date (📅)", () => {
		expect(extractEmojiDate("test 📅 2026-07-10", "📅")).toBe("2026-07-10");
	});

	it("extracts the start date (🛫) distinctly from the due date", () => {
		const text = "test 🛫 2026-07-01 📅 2026-07-10";
		expect(extractEmojiDate(text, "🛫")).toBe("2026-07-01");
		expect(extractEmojiDate(text, "📅")).toBe("2026-07-10");
	});

	it("returns undefined when the emoji is absent", () => {
		expect(extractEmojiDate("test", "✅")).toBeUndefined();
	});
});

describe("extractInline / extractInlineList", () => {
	it("extracts a single inline field value", () => {
		expect(extractInline("test [priority:: high]", "priority")).toBe("high");
	});

	it("returns undefined when the key is absent", () => {
		expect(extractInline("test", "priority")).toBeUndefined();
	});

	it("splits, trims, and drops empty entries for a list field", () => {
		expect(extractInlineList("test [labels:: home, , urgent ]", "labels")).toEqual(["home", "urgent"]);
	});

	it("returns an empty array when the list key is absent", () => {
		expect(extractInlineList("test", "labels")).toEqual([]);
	});
});

describe("normalizePriority", () => {
	it("passes through known priority values case-insensitively", () => {
		expect(normalizePriority("high")).toBe("high");
		expect(normalizePriority("Medium")).toBe("medium");
		expect(normalizePriority("LOW")).toBe("low");
	});

	it("maps highest/lowest aliases", () => {
		expect(normalizePriority("highest")).toBe("high");
		expect(normalizePriority("lowest")).toBe("low");
	});

	it("returns undefined for unrecognized or missing values", () => {
		expect(normalizePriority("urgent")).toBeUndefined();
		expect(normalizePriority(undefined)).toBeUndefined();
		expect(normalizePriority(null)).toBeUndefined();
	});
});

describe("buildTodoLine", () => {
	it("builds a minimal line with just the text", () => {
		expect(buildTodoLine({ text: " buy milk " })).toBe("- [ ] buy milk");
	});

	it("appends a due-date emoji and priority inline field when provided", () => {
		expect(buildTodoLine({ text: "buy milk", dueDate: "2026-07-10", priority: "high" })).toBe(
			"- [ ] buy milk 📅 2026-07-10 [priority:: high]"
		);
	});
});

describe("rebuildTodoLine", () => {
	function makeTodo(overrides: Partial<Todo>): Todo {
		return {
			filePath: "a.md",
			line: 0,
			text: "buy milk",
			done: false,
			labels: [],
			parentType: "inbox",
			parentPath: "a.md",
			...overrides,
		};
	}

	it("prefers rawText over the stripped display text", () => {
		const todo = makeTodo({ rawText: "buy milk 📅 2026-07-10", text: "buy milk" });
		expect(rebuildTodoLine(todo)).toBe("- [ ] buy milk 📅 2026-07-10");
	});

	it("falls back to the display text when rawText is unset", () => {
		const todo = makeTodo({});
		expect(rebuildTodoLine(todo)).toBe("- [ ] buy milk");
	});

	it("uses the done checkbox when the todo is completed", () => {
		const todo = makeTodo({ done: true, rawText: "buy milk ✅ 2026-07-01" });
		expect(rebuildTodoLine(todo)).toBe("- [x] buy milk ✅ 2026-07-01");
	});

	it("preserves the original indent so editLine can match nested todo lines", () => {
		const todo = makeTodo({ indent: "  ", rawText: "sub task" });
		expect(rebuildTodoLine(todo)).toBe("  - [ ] sub task");
	});

	it("strips the indent when stripIndent is requested (e.g. moving into a new note)", () => {
		const todo = makeTodo({ indent: "  ", rawText: "sub task" });
		expect(rebuildTodoLine(todo, { stripIndent: true })).toBe("- [ ] sub task");
	});
});
