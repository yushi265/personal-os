import { describe, expect, it } from "vitest";
import { appendMemo, parseMemoSection, removeMemo, updateMemo, type Memo } from "../../src/domain/memo";

describe("parseMemoSection", () => {
	it("P-1: returns an empty array when there is no '## Memo' section", () => {
		expect(parseMemoSection("# Note\n\nSome content\n")).toEqual([]);
	});

	it("P-2: parses a single heading with a single-line body", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nBank replied.\n";
		expect(parseMemoSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "Bank replied." }]);
	});

	it("P-3: parses multiple headings with multi-line bodies, separating them correctly", () => {
		const body =
			"## Memo\n\n### 2026-07-04 16:30\nRate confirmed at 1.2%\n\n### 2026-07-04 18:02\nReflected in the table.\nNext up: movers.\n";
		expect(parseMemoSection(body)).toEqual([
			{ datetime: "2026-07-04 16:30", text: "Rate confirmed at 1.2%" },
			{ datetime: "2026-07-04 18:02", text: "Reflected in the table.\nNext up: movers." },
		]);
	});

	it("P-4: ignores free-form text preceding the first valid heading", () => {
		const body = "## Memo\n\nSome unstructured note left by hand.\n\n### 2026-07-04 16:30\nActual memo.\n";
		expect(parseMemoSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "Actual memo." }]);
	});

	it("P-5: cuts off the preceding memo's text at a following mismatched heading, and excludes that heading", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nActual memo.\n### not a timestamp\nmore free text\n";
		expect(parseMemoSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "Actual memo." }]);
	});

	it("P-6: keeps duplicate same-minute headings as separate Memo entries", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nFirst.\n\n### 2026-07-04 16:30\nSecond.\n";
		expect(parseMemoSection(body)).toEqual([
			{ datetime: "2026-07-04 16:30", text: "First." },
			{ datetime: "2026-07-04 16:30", text: "Second." },
		]);
	});

	it("P-7: recovers the final memo's text even when the body has no trailing newline", () => {
		const body = "## Memo\n\n### 2026-07-04 16:30\nlast line, no trailing newline";
		expect(parseMemoSection(body)).toEqual([{ datetime: "2026-07-04 16:30", text: "last line, no trailing newline" }]);
	});
});

describe("appendMemo", () => {
	const DATETIME = "2026-07-04 16:30";

	it("A-1: creates a new '## Memo' section at the end when none exists", () => {
		const body = "# Note\n\nSome content\n";
		expect(appendMemo(body, DATETIME, "Bank replied.")).toBe(
			"# Note\n\nSome content\n\n## Memo\n\n### 2026-07-04 16:30\nBank replied.\n"
		);
	});

	it("A-2: appends after the last non-empty line of an existing section with a blank-line separator", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text";
		expect(appendMemo(body, DATETIME, "new text")).toBe(
			"## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 16:30\nnew text"
		);
	});

	it("A-3: inserts a multi-line text with each line preserved", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text";
		expect(appendMemo(body, DATETIME, "line one\nline two")).toBe(
			"## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 16:30\nline one\nline two"
		);
	});

	it("A-4: inserts before a following section, leaving it untouched", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text\n## Todo\n- [ ] existing";
		expect(appendMemo(body, DATETIME, "new text")).toBe(
			"## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 16:30\nnew text\n## Todo\n- [ ] existing"
		);
	});
});

describe("updateMemo / removeMemo", () => {
	function make(datetime: string, text: string): Memo {
		return { datetime, text };
	}

	it("U-1: replaces only the matched block's body, keeping the heading datetime and other blocks unchanged", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 11:00\nother memo\n";
		const result = updateMemo(body, make("2026-07-04 10:00", "old text"), "updated text");
		expect(result).toBe("## Memo\n\n### 2026-07-04 10:00\nupdated text\n\n### 2026-07-04 11:00\nother memo\n");
	});

	it("U-1 (remove): removes only the matched block, keeping other blocks unchanged", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nold text\n\n### 2026-07-04 11:00\nother memo\n";
		const result = removeMemo(body, make("2026-07-04 10:00", "old text"));
		expect(result).toBe("## Memo\n\n### 2026-07-04 11:00\nother memo\n");
	});

	it("U-2: returns null (conflict) when zero memos match (already changed/removed externally)", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\ncurrent text\n";
		expect(updateMemo(body, make("2026-07-04 10:00", "stale text"), "new text")).toBeNull();
		expect(removeMemo(body, make("2026-07-04 10:00", "stale text"))).toBeNull();
	});

	it("U-3: returns null (conflict) when two or more memos match (duplicate same-minute memo)", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nsame text\n\n### 2026-07-04 10:00\nsame text\n";
		expect(updateMemo(body, make("2026-07-04 10:00", "same text"), "new text")).toBeNull();
		expect(removeMemo(body, make("2026-07-04 10:00", "same text"))).toBeNull();
	});

	it("U-4: removing the note's only memo keeps the '## Memo' heading, leaving an empty section", () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nonly memo\n";
		expect(removeMemo(body, make("2026-07-04 10:00", "only memo"))).toBe("## Memo\n");
	});
});
