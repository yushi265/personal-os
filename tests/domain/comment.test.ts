import { describe, expect, it } from "vitest";
import {
	appendComment,
	countCommentHeadings,
	parseCommentSection,
	removeComment,
	updateComment,
	type HeadingLike,
	type Comment,
} from "../../src/domain/comment";

describe("storage compatibility (F3 rename)", () => {
	it("S-1: appendComment still writes the literal '## Memo' heading (storage unchanged by the memo→comment rename)", () => {
		const result = appendComment("# Note\n", "2026-07-05 10:00", "hello");
		expect(result).toContain("## Memo");
		expect(result).not.toContain("## Comment");
	});

	it("S-2: parseCommentSection still reads the literal '## Memo' heading (existing notes remain readable)", () => {
		const body = "## Memo\n\n### 2026-07-05 10:00\nhello\n";
		expect(parseCommentSection(body)).toEqual([{ datetime: "2026-07-05 10:00", text: "hello" }]);
	});
});

describe("parseCommentSection", () => {
	it("P-1: returns an empty array when there is no '## Memo' section", () => {
		expect(parseCommentSection("# Note\n\nSome content\n")).toEqual([]);
	});

	it("P-2: parses a single heading with a single-line body", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nBank replied.\n";
		expect(parseCommentSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "Bank replied." }]);
	});

	it("P-3: parses multiple headings with multi-line bodies, separating them correctly", () => {
		const body =
			"## Memo\n\n### 2026-07-04 16:30\nRate confirmed at 1.2%\n\n### 2026-07-04 18:02\nReflected in the table.\nNext up: movers.\n";
		expect(parseCommentSection(body)).toEqual([
			{ datetime: "2026-07-04 16:30", text: "Rate confirmed at 1.2%" },
			{ datetime: "2026-07-04 18:02", text: "Reflected in the table.\nNext up: movers." },
		]);
	});

	it("P-4: ignores free-form text preceding the first valid heading", () => {
		const body = "## Memo\n\nSome unstructured note left by hand.\n\n### 2026-07-04 16:30\nActual memo.\n";
		expect(parseCommentSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "Actual memo." }]);
	});

	it("P-5: cuts off the preceding memo's text at a following mismatched heading, and excludes that heading", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nActual memo.\n### not a timestamp\nmore free text\n";
		expect(parseCommentSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "Actual memo." }]);
	});

	it("P-6: keeps duplicate same-minute headings as separate Memo entries", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nFirst.\n\n### 2026-07-04 16:30\nSecond.\n";
		expect(parseCommentSection(body)).toEqual([
			{ datetime: "2026-07-04 16:30", text: "First." },
			{ datetime: "2026-07-04 16:30", text: "Second." },
		]);
	});

	it("P-7: recovers the final memo's text even when the body has no trailing newline", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nlast line, no trailing newline";
		expect(parseCommentSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "last line, no trailing newline" }]);
	});
});

describe("appendComment", () => {
	const DATETIME = "2026-07-04 16:30";

	it("A-1: creates a new '## Memo' section at the end when none exists", () => {
		const body = "# Note\n\nSome content\n";
		expect(appendComment(body, DATETIME, "Bank replied.")).toBe(
			"# Note\n\nSome content\n\n## Memo\n\n### 2026-07-04 16:30\nBank replied.\n"
		);
	});

	it("A-2: appends after the last non-empty line of an existing section with a blank-line separator", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text";
		expect(appendComment(body, DATETIME, "new text")).toBe(
			"## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 16:30\nnew text"
		);
	});

	it("A-3: inserts a multi-line text with each line preserved", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text";
		expect(appendComment(body, DATETIME, "line one\nline two")).toBe(
			"## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 16:30\nline one\nline two"
		);
	});

	it("A-4: inserts before a following section, leaving it untouched", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text\n## Todo\n- [ ] existing";
		expect(appendComment(body, DATETIME, "new text")).toBe(
			"## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 16:30\nnew text\n## Todo\n- [ ] existing"
		);
	});
});

describe("updateComment / removeComment", () => {
	function make(datetime: string, text: string): Comment {
		return { datetime, text };
	}

	it("U-1: replaces only the matched block's body, keeping the heading datetime and other blocks unchanged", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 11:00\nother memo\n";
		const result = updateComment(body, make("2026-07-04 10:00", "old text"), "updated text");
		expect(result).toBe("## Memo\n\n### 2026-07-04 10:00\nupdated text\n\n### 2026-07-04 11:00\nother memo\n");
	});

	it("U-1 (remove): removes only the matched block, keeping other blocks unchanged", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 11:00\nother memo\n";
		const result = removeComment(body, make("2026-07-04 10:00", "old text"));
		expect(result).toBe("## Memo\n\n### 2026-07-04 11:00\nother memo\n");
	});

	it("U-2: returns null (conflict) when zero memos match (already changed/removed externally)", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\ncurrent text\n";
		expect(updateComment(body, make("2026-07-04 10:00", "stale text"), "new text")).toBeNull();
		expect(removeComment(body, make("2026-07-04 10:00", "stale text"))).toBeNull();
	});

	it("U-3: returns null (conflict) when two or more memos match (duplicate same-minute memo)", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nsame text\n\n### 2026-07-04 10:00\nsame text\n";
		expect(updateComment(body, make("2026-07-04 10:00", "same text"), "new text")).toBeNull();
		expect(removeComment(body, make("2026-07-04 10:00", "same text"))).toBeNull();
	});

	it("U-4: removing the note's only memo keeps the '## Memo' heading, leaving an empty section", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nonly memo\n";
		expect(removeComment(body, make("2026-07-04 10:00", "only memo"))).toBe("## Memo\n");
	});
});

describe("countCommentHeadings", () => {
	function h(heading: string, level: number): HeadingLike {
		return { heading, level };
	}

	it("H-1: returns 0 when there is no '## Memo' (level 2) heading", () => {
		expect(countCommentHeadings([h("Detail", 2), h("2026-07-04 10:00", 3)])).toBe(0);
	});

	it("H-2: counts valid level-3 datetime headings under '## Memo'", () => {
		const headings = [h("Detail", 2), h("Memo", 2), h("2026-07-04 10:00", 3), h("2026-07-04 11:00", 3)];
		expect(countCommentHeadings(headings)).toBe(2);
	});

	it("H-3: stops counting once a level<=2 heading follows (leaving the Memo section)", () => {
		const headings = [h("Memo", 2), h("2026-07-04 10:00", 3), h("Next Section", 2), h("2026-07-04 11:00", 3)];
		expect(countCommentHeadings(headings)).toBe(1);
	});

	it("H-4: ignores level-3 headings that don't match the datetime pattern (freeform notes)", () => {
		const headings = [h("Memo", 2), h("not a timestamp", 3), h("2026-07-04 10:00", 3)];
		expect(countCommentHeadings(headings)).toBe(1);
	});

	it("H-5: returns 0 for an empty headings array", () => {
		expect(countCommentHeadings([])).toBe(0);
	});
});
