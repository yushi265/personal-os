import { describe, expect, it } from "vitest";
import {
	appendTodoToSection,
	buildTodoLine,
	defaultProjectForTodo,
	extractEmojiDate,
	extractInline,
	extractInlineList,
	isCancelledTodo,
	moveTodoLine,
	normalizePriority,
	rebuildTodoLine,
	setTodoLineCancelled,
	stripMetadata,
	toggleTodoLine,
	updateTodoLine,
	type Todo,
} from "../../src/domain/todo";
import type { Entity } from "../../src/domain/entity";

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

	it("T-4: leaves a cancelled todo line unchanged (no-op)", () => {
		const result = toggleTodoLine("- [-] x", "2026-07-04");
		expect(result).toBe("- [-] x");
	});
});

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

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Tickets/ticket-a.md",
		type: "ticket",
		title: "銀行比較",
		status: "doing",
		tags: [],
		labels: [],
		extra: {},
		...overrides,
	};
}

describe("defaultProjectForTodo", () => {
	it("returns the parent project path when parentType is project", () => {
		const todo = makeTodo({ parentType: "project", parentPath: "PersonalOS/Projects/project-a.md" });
		expect(defaultProjectForTodo(todo, () => undefined)).toBe("PersonalOS/Projects/project-a.md");
	});

	it("returns the parent ticket's project when parentType is ticket", () => {
		const todo = makeTodo({ parentType: "ticket", parentPath: "PersonalOS/Tickets/ticket-a.md" });
		const ticket = makeEntity({ path: "PersonalOS/Tickets/ticket-a.md", project: "PersonalOS/Projects/project-a.md" });
		const getEntity = (path: string) => (path === ticket.path ? ticket : undefined);
		expect(defaultProjectForTodo(todo, getEntity)).toBe("PersonalOS/Projects/project-a.md");
	});

	it("returns undefined when the parent ticket has no project", () => {
		const todo = makeTodo({ parentType: "ticket", parentPath: "PersonalOS/Tickets/ticket-a.md" });
		const ticket = makeEntity({ path: "PersonalOS/Tickets/ticket-a.md" });
		expect(defaultProjectForTodo(todo, () => ticket)).toBeUndefined();
	});

	it("returns undefined for inbox todos", () => {
		const todo = makeTodo({ parentType: "inbox", parentPath: "00_Inbox/note.md" });
		expect(defaultProjectForTodo(todo, () => undefined)).toBeUndefined();
	});
});

describe("isCancelledTodo", () => {
	it("returns true when statusChar is '-'", () => {
		const todo = makeTodo({ statusChar: "-" });
		expect(isCancelledTodo(todo)).toBe(true);
	});

	it("returns false when statusChar is absent", () => {
		const todo = makeTodo({});
		expect(isCancelledTodo(todo)).toBe(false);
	});

	it("returns false when statusChar is a different character (e.g. done)", () => {
		const todo = makeTodo({ statusChar: "x", done: true });
		expect(isCancelledTodo(todo)).toBe(false);
	});
});

describe("setTodoLineCancelled", () => {
	it("S-1: cancels an open todo", () => {
		expect(setTodoLineCancelled("- [ ] buy milk", true)).toBe("- [-] buy milk");
	});

	it("S-2: restores a cancelled todo to open", () => {
		expect(setTodoLineCancelled("- [-] buy milk", false)).toBe("- [ ] buy milk");
	});

	it("S-3: cancelling a done todo removes the done-emoji date", () => {
		expect(setTodoLineCancelled("- [x] buy milk ✅ 2026-01-01", true)).toBe("- [-] buy milk");
	});

	it("S-4: preserves leading indentation for a nested todo", () => {
		expect(setTodoLineCancelled("  - [ ] sub", true)).toBe("  - [-] sub");
	});

	it("returns the line unchanged when it has no checkbox (upstream conflict detection handles it)", () => {
		expect(setTodoLineCancelled("not a todo line", true)).toBe("not a todo line");
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

	it("uses statusChar '-' to restore a cancelled checkbox", () => {
		const todo = makeTodo({ statusChar: "-", rawText: "cancelled task" });
		expect(rebuildTodoLine(todo)).toBe("- [-] cancelled task");
	});

	it("preserves a custom checkbox character via statusChar", () => {
		const todo = makeTodo({ statusChar: "/", rawText: "in progress task" });
		expect(rebuildTodoLine(todo)).toBe("- [/] in progress task");
	});

	it("falls back to the done-based checkbox when statusChar is an empty string", () => {
		const todo = makeTodo({ done: false, statusChar: "", rawText: "todo" });
		expect(rebuildTodoLine(todo)).toBe("- [ ] todo");
	});

	it("falls back to the done-based checkbox when statusChar has more than one character", () => {
		const todo = makeTodo({ done: true, statusChar: "xx", rawText: "todo" });
		expect(rebuildTodoLine(todo)).toBe("- [x] todo");
	});
});

describe("updateTodoLine", () => {
	function makeTodo(overrides: Partial<Todo> = {}): Todo {
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

	it("U-1: changes only text, preserving the existing due date and priority", () => {
		const todo = makeTodo({ dueDate: "2026-07-10", priority: "high" });
		expect(updateTodoLine(todo, { text: "buy bread" })).toBe("- [ ] buy bread 📅 2026-07-10 [priority:: high]");
	});

	it("U-2: assigns a new due date when the original todo had none", () => {
		const todo = makeTodo();
		expect(updateTodoLine(todo, { dueDate: "2026-07-10" })).toBe("- [ ] buy milk 📅 2026-07-10");
	});

	it("U-3: removes the due date when dueDate is null", () => {
		const todo = makeTodo({ dueDate: "2026-07-10" });
		expect(updateTodoLine(todo, { dueDate: null })).toBe("- [ ] buy milk");
	});

	it("U-4: removes the priority when priority is null", () => {
		const todo = makeTodo({ priority: "high" });
		expect(updateTodoLine(todo, { priority: null })).toBe("- [ ] buy milk");
	});

	it("U-5: preserves labels when only text changes", () => {
		const todo = makeTodo({ labels: ["home", "urgent"] });
		expect(updateTodoLine(todo, { text: "buy bread" })).toBe("- [ ] buy bread [labels:: home, urgent]");
	});

	it("U-6: preserves indentation for a nested todo", () => {
		const todo = makeTodo({ indent: "  ", text: "sub task" });
		expect(updateTodoLine(todo, { text: "sub task updated" })).toBe("  - [ ] sub task updated");
	});

	it("U-7: preserves both startDate and doneDate while changing only the due date", () => {
		const todo = makeTodo({
			done: true,
			startDate: "2026-07-01",
			doneDate: "2026-07-03",
			dueDate: "2026-07-05",
		});
		expect(updateTodoLine(todo, { dueDate: "2026-07-10" })).toBe(
			"- [x] buy milk 🛫 2026-07-01 📅 2026-07-10 ✅ 2026-07-03"
		);
	});

	it("U-8: preserves the cancelled checkbox character when only text changes", () => {
		const todo = makeTodo({ statusChar: "-", text: "buy milk" });
		expect(updateTodoLine(todo, { text: "buy bread" })).toBe("- [-] buy bread");
	});
});

describe("appendTodoToSection", () => {
	const NEW_LINE = "- [ ] new item";

	it("A-1: appends a new '## Todo' section at the end when none exists", () => {
		const body = "# Note\n\nSome content\n";
		expect(appendTodoToSection(body, NEW_LINE)).toBe("# Note\n\nSome content\n\n## Todo\n- [ ] new item\n");
	});

	it("A-2: inserts after the last non-empty line of an existing section with multiple todos", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2";
		expect(appendTodoToSection(body, NEW_LINE)).toBe("## Todo\n- [ ] item1\n- [ ] item2\n- [ ] new item");
	});

	it("A-3: inserts before a following heading, leaving content after it untouched", () => {
		const body = "## Todo\n- [ ] item1\n## Note\nother content";
		expect(appendTodoToSection(body, NEW_LINE)).toBe(
			"## Todo\n- [ ] item1\n- [ ] new item\n## Note\nother content"
		);
	});

	it("A-4: normalizes to a single blank line before a new section when the body has no trailing newline", () => {
		const body = "# Note";
		expect(appendTodoToSection(body, NEW_LINE)).toBe("# Note\n\n## Todo\n- [ ] new item\n");
	});

	it("A-5: inserts directly after the heading when the section is empty (EOF or next heading immediately follows)", () => {
		expect(appendTodoToSection("## Todo", NEW_LINE)).toBe("## Todo\n- [ ] new item");
		expect(appendTodoToSection("## Todo\n## Note\ncontent", NEW_LINE)).toBe(
			"## Todo\n- [ ] new item\n## Note\ncontent"
		);
	});

	it("§7.6: does not recognize heading variants like '## TODO', so a duplicate '## Todo' section is added", () => {
		const body = "## TODO\n- [ ] existing";
		expect(appendTodoToSection(body, NEW_LINE)).toBe("## TODO\n- [ ] existing\n\n## Todo\n- [ ] new item\n");
	});
});

describe("moveTodoLine", () => {
	const todoB: Todo = {
		filePath: "PersonalOS/Tickets/ticket-a.md",
		line: 1,
		text: "item2",
		done: false,
		labels: [],
		parentType: "ticket",
		parentPath: "PersonalOS/Tickets/ticket-a.md",
	};

	it("moves the line up by one position", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2\n- [ ] item3";
		expect(moveTodoLine(body, todoB, { kind: "up" })).toBe("## Todo\n- [ ] item2\n- [ ] item1\n- [ ] item3");
	});

	it("moves the line down by one position", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2\n- [ ] item3";
		expect(moveTodoLine(body, todoB, { kind: "down" })).toBe("## Todo\n- [ ] item1\n- [ ] item3\n- [ ] item2");
	});

	it("moves the line before another line's exact content", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2\n- [ ] item3";
		expect(moveTodoLine(body, todoB, { kind: "beforeLine", lineContent: "## Todo" })).toBe(
			"- [ ] item2\n## Todo\n- [ ] item1\n- [ ] item3"
		);
	});

	it("moves the line after another line's exact content", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2\n- [ ] item3";
		expect(moveTodoLine(body, todoB, { kind: "afterLine", lineContent: "- [ ] item3" })).toBe(
			"## Todo\n- [ ] item1\n- [ ] item3\n- [ ] item2"
		);
	});

	it("leaves other lines unchanged when moving", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2\n- [ ] item3";
		const result = moveTodoLine(body, todoB, { kind: "down" });
		expect(result).toContain("- [ ] item1");
		expect(result).toContain("- [ ] item3");
	});

	it("returns null when the expected line content does not match (concurrent edit)", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2-modified\n- [ ] item3";
		expect(moveTodoLine(body, todoB, { kind: "up" })).toBeNull();
	});

	it("returns null when the beforeLine/afterLine target content is not found", () => {
		const body = "## Todo\n- [ ] item1\n- [ ] item2\n- [ ] item3";
		expect(moveTodoLine(body, todoB, { kind: "beforeLine", lineContent: "- [ ] nonexistent" })).toBeNull();
	});
});
