import { describe, expect, it } from "vitest";
import { bodyPreviewLines, resolveParseError } from "../../src/ui/preview/previewData";

describe("resolveParseError", () => {
	it("returns the reason for a matching path", () => {
		const errors = [
			{ path: "a.md", reason: "type未定義" },
			{ path: "b.md", reason: "不正なtype: foo" },
		];
		expect(resolveParseError(errors, "b.md")).toBe("不正なtype: foo");
	});

	it("returns undefined when no entry matches the path", () => {
		const errors = [{ path: "a.md", reason: "type未定義" }];
		expect(resolveParseError(errors, "c.md")).toBeUndefined();
	});
});

describe("bodyPreviewLines", () => {
	it("strips a leading frontmatter block and returns the remaining lines", () => {
		const raw = "---\ntype: ticket\nstatus: doing\n---\nline1\nline2\n";
		expect(bodyPreviewLines(raw)).toEqual(["line1", "line2", ""]);
	});

	it("returns lines as-is when there is no frontmatter block", () => {
		const raw = "line1\nline2";
		expect(bodyPreviewLines(raw)).toEqual(["line1", "line2"]);
	});

	it("truncates to maxLines", () => {
		const raw = Array.from({ length: 30 }, (_, i) => `line${i}`).join("\n");
		expect(bodyPreviewLines(raw, 5)).toEqual(["line0", "line1", "line2", "line3", "line4"]);
	});
});
