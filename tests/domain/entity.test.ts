import { describe, expect, it } from "vitest";
import { computeOrderForInsert, parseEntity } from "../../src/domain/entity";

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

	it("normalizes single-string tags/labels into arrays", () => {
		const result = parseEntity(
			file,
			{ type: "ticket", status: "doing", tags: "solo", labels: "solo-label" },
			resolveLink
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entity.tags).toEqual(["solo"]);
			expect(result.entity.labels).toEqual(["solo-label"]);
		}
	});

	// Blockers概念廃止(既存Vaultにblockers付きノートがあってもパースエラーにならず、非破壊でextraへ落ちることを担保する)
	it("no longer reads frontmatter blockers as a known field; it falls through to extra", () => {
		const result = parseEntity(file, { type: "ticket", status: "doing", blockers: ["waiting"] }, resolveLink);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entity).not.toHaveProperty("blockers");
			expect(result.entity.extra.blockers).toEqual(["waiting"]);
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

	it("parses order as a number without warning", () => {
		const result = parseEntity(file, { type: "ticket", status: "doing", order: "150" }, resolveLink);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entity.order).toBe(150);
			expect(result.warnings).toEqual([]);
		}
	});

	it("leaves order undefined without warning when not a number", () => {
		const result = parseEntity(file, { type: "ticket", status: "doing", order: "abc" }, resolveLink);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.entity.order).toBeUndefined();
			expect(result.warnings).toEqual([]);
		}
	});
});

describe("computeOrderForInsert", () => {
	it("assigns midpoint when inserting in the middle with sufficient gap", () => {
		const rows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: 200 },
			{ path: "p3", order: 300 },
		];
		// move p3 (index 2) to between p1 and p2 (index 1 after removal)
		const result = computeOrderForInsert(rows, 2, 1);
		expect(result).toEqual([{ path: "p3", order: 150 }]);
	});

	it("assigns a value before the first order when inserting at the head", () => {
		const rows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: 200 },
			{ path: "p3", order: 300 },
		];
		// move p3 (index 2) to the head (index 0 after removal)
		const result = computeOrderForInsert(rows, 2, 0);
		expect(result).toEqual([{ path: "p3", order: 50 }]);
	});

	it("appends after the last order when inserting at the tail", () => {
		const rows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: 200 },
		];
		// move p1 (index 0) to the tail (index 1 after removal, i.e. after p2)
		const result = computeOrderForInsert(rows, 0, 1);
		expect(result).toEqual([{ path: "p1", order: 300 }]);
	});

	it("renumbers only the affected local range when the gap is exhausted", () => {
		const rows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: 101 },
			{ path: "p3", order: 300 },
		];
		// move p3 (index 2) between p1 and p2 (index 1 after removal), gap is 1 -> renumber
		const result = computeOrderForInsert(rows, 2, 1);
		expect(result).toEqual(
			expect.arrayContaining([
				{ path: "p3", order: 200 },
				{ path: "p2", order: 300 },
			])
		);
		expect(result.length).toBe(2);
		expect(result.some((r) => r.path === "p1")).toBe(false);
	});

	it("treats rows with undefined order as tail neighbors and skips no-op changes", () => {
		const rows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: undefined },
			{ path: "p3", order: 200 },
		];
		// move p1 (index 0) to between p2 and p3 (index 1 after removal)
		const result = computeOrderForInsert(rows, 0, 1);
		// prev(p2) has no order -> treated as virtual 0; next(p3)=200 -> midpoint(0,200)=100, already p1's order
		expect(result).toEqual([]);
	});

	it("returns empty array for a no-op move", () => {
		const rows = [
			{ path: "p1", order: 100 },
			{ path: "p2", order: 200 },
		];
		const result = computeOrderForInsert(rows, 0, 0);
		expect(result).toEqual([]);
	});
});
