import { describe, expect, it } from "vitest";
import { parseNoteSection, writeNoteSection } from "../../src/domain/note";

describe("parseNoteSection", () => {
	it("N-1: returns an empty string when there is no '## Note' section", () => {
		expect(parseNoteSection("# Ticket\n\nSome content\n")).toBe("");
	});

	it("returns the section body when '## Note' exists", () => {
		const body = "# Ticket\n\n## Note\nSome memo text.\nSecond line.\n";
		expect(parseNoteSection(body)).toBe("Some memo text.\nSecond line.");
	});

	it("N-2: stops at the next level 1-2 heading and excludes '## Memo' content", () => {
		const body = "## Note\nmy note\n\n## Memo\n\n### 2026-07-05 10:00\na comment\n";
		expect(parseNoteSection(body)).toBe("my note");
	});

	it("trims trailing blank lines but keeps internal blank lines", () => {
		const body = "## Note\nline one\n\nline two\n\n\n";
		expect(parseNoteSection(body)).toBe("line one\n\nline two");
	});
});

describe("writeNoteSection", () => {
	it("N-3: creates a new '## Note' section at the end when none exists and there is no '## Memo' section", () => {
		const body = "# Ticket\n\nSome content\n";
		expect(writeNoteSection(body, "new note")).toBe("# Ticket\n\nSome content\n\n## Note\nnew note\n");
	});

	it("creates '## Note' immediately before an existing '## Memo' section", () => {
		const body = "# Ticket\n\nSome content\n\n## Memo\n\n### 2026-07-05 10:00\nhi\n";
		expect(writeNoteSection(body, "new note")).toBe(
			"# Ticket\n\nSome content\n\n## Note\nnew note\n\n## Memo\n\n### 2026-07-05 10:00\nhi\n"
		);
	});

	it("N-4: overwrites the whole existing body rather than appending", () => {
		const body = "## Note\nold text\n";
		expect(writeNoteSection(body, "replacement text")).toBe("## Note\nreplacement text\n");
	});

	it("preserves a following section when overwriting", () => {
		const body = "## Note\nold text\n\n## Memo\n\n### 2026-07-05 10:00\nhi\n";
		expect(writeNoteSection(body, "replacement text")).toBe("## Note\nreplacement text\n\n## Memo\n\n### 2026-07-05 10:00\nhi\n");
	});

	it("N-5: removes the '## Note' heading entirely when text is empty", () => {
		const body = "# Ticket\n\n## Note\nold text\n";
		expect(writeNoteSection(body, "")).toBe("# Ticket\n");
	});

	it("removes the heading when text is whitespace-only, keeping a following section intact", () => {
		const body = "# Ticket\n\n## Note\nold text\n\n## Memo\n\n### 2026-07-05 10:00\nhi\n";
		expect(writeNoteSection(body, "   \n  ")).toBe("# Ticket\n\n## Memo\n\n### 2026-07-05 10:00\nhi\n");
	});

	it("is a no-op when text is empty and no section exists", () => {
		const body = "# Ticket\n\nSome content\n";
		expect(writeNoteSection(body, "")).toBe(body);
	});
});
