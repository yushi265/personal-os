import { describe, expect, it } from "vitest";
import { parseEntity } from "../../src/domain/entity";

const file = { path: "PersonalOS/Tickets/foo.md", basename: "foo" };
const resolveLink = (link: string): string | null => {
	if (link === "住宅購入") return "PersonalOS/Projects/住宅購入.md";
	return null;
};

describe("parseEntity", () => {
	it("returns error when type is missing", () => {
		const result = parseEntity(file, undefined, resolveLink);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("type未定義");
	});

	it("returns error for invalid type", () => {
		const result = parseEntity(file, { type: "unknown" }, resolveLink);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("不正なtype");
	});

	it("returns error for invalid status", () => {
		const result = parseEntity(file, { type: "ticket", status: "not-a-status" }, resolveLink);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("不正なstatus");
	});

	it("defaults status per type when unspecified", () => {
		const goalResult = parseEntity({ path: "g.md", basename: "g" }, { type: "goal" }, resolveLink);
		expect(goalResult.ok).toBe(true);
		if (goalResult.ok) expect(goalResult.entity.status).toBe("active");

		const projectResult = parseEntity({ path: "p.md", basename: "p" }, { type: "project" }, resolveLink);
		expect(projectResult.ok).toBe(true);
		if (projectResult.ok) expect(projectResult.entity.status).toBe("backlog");
	});

	it("collects warnings and undefines invalid priority/date instead of failing", () => {
		const result = parseEntity(
			file,
			{ type: "ticket", status: "doing", priority: "urgent", due: "not-a-date" },
			resolveLink
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entity.priority).toBeUndefined();
			expect(result.entity.due).toBeUndefined();
			expect(result.warnings.some((w) => w.includes("priority"))).toBe(true);
			expect(result.warnings.some((w) => w.includes("due"))).toBe(true);
		}
	});

	it("preserves unknown frontmatter keys in extra", () => {
		const result = parseEntity(file, { type: "ticket", status: "doing", custom_field: "keep-me" }, resolveLink);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.entity.extra.custom_field).toBe("keep-me");
	});

	it("normalizes single-string tags/labels/blockers into arrays", () => {
		const result = parseEntity(
			file,
			{ type: "ticket", status: "doing", tags: "solo", labels: "solo-label", blockers: "waiting" },
			resolveLink
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entity.tags).toEqual(["solo"]);
			expect(result.entity.labels).toEqual(["solo-label"]);
			expect(result.entity.blockers).toEqual(["waiting"]);
		}
	});

	it("clamps progress into 0-100 range", () => {
		const over = parseEntity(file, { type: "ticket", status: "doing", progress: 150 }, resolveLink);
		const under = parseEntity(file, { type: "ticket", status: "doing", progress: -20 }, resolveLink);
		expect(over.ok && over.entity.progress).toBe(100);
		expect(under.ok && under.entity.progress).toBe(0);
	});

	it("resolves goal/project wikilinks via resolveLink", () => {
		const result = parseEntity(file, { type: "ticket", status: "doing", project: "[[住宅購入]]" }, resolveLink);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.entity.project).toBe("PersonalOS/Projects/住宅購入.md");
	});

	it("keeps original text with warning when link cannot be resolved", () => {
		const result = parseEntity(file, { type: "ticket", status: "doing", project: "[[存在しない]]" }, resolveLink);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entity.project).toBe("[[存在しない]]");
			expect(result.warnings.some((w) => w.includes("project"))).toBe(true);
		}
	});
});
