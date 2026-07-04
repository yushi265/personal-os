import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Entity } from "../../src/domain/entity";
import { buildTimelineRows } from "../../src/ui/timeline/timelineData";

function makeEntity(overrides: Partial<Entity>): Entity {
	return {
		path: "PersonalOS/Projects/p.md",
		type: "project",
		title: "p",
		status: "active",
		tags: [],
		labels: [],
		blockers: [],
		extra: {},
		...overrides,
	};
}

describe("buildTimelineRows", () => {
	it("start/dueどちらも持たないEntityは除外し、todayのみのrangeで空を返す", () => {
		const data = buildTimelineRows([makeEntity({ path: "a.md" })]);
		expect(data.rows).toEqual([]);
		expect(data.rangeStart).toBe(data.rangeEnd);
		expect(data.todayPct).toBeNull();
		expect(data.monthMarkers).toEqual([]);
	});

	it("statusを行に含め、start/dueから位置(%)を算出する", () => {
		const data = buildTimelineRows([
			makeEntity({ path: "a.md", status: "doing", start: "2026-01-01", due: "2026-01-11" }),
			makeEntity({ path: "b.md", status: "done", due: "2026-01-06" }),
		]);
		expect(data.rangeStart).toBe("2026-01-01");
		expect(data.rangeEnd).toBe("2026-01-11");
		const bar = data.rows.find((r) => r.path === "a.md")!;
		expect(bar.status).toBe("doing");
		expect(bar.isPoint).toBe(false);
		expect(bar.leftPct).toBe(0);
		expect(bar.widthPct).toBeCloseTo(100, 5);
		const point = data.rows.find((r) => r.path === "b.md")!;
		expect(point.status).toBe("done");
		expect(point.isPoint).toBe(true);
		expect(point.widthPct).toBe(0);
	});

	it("rangeにまたがる月初ごとにmonthMarkersを生成し、年をまたぐ場合はラベルに年を含める", () => {
		const data = buildTimelineRows([makeEntity({ path: "a.md", start: "2025-12-20", due: "2026-02-05" })]);
		expect(data.monthMarkers.map((m) => m.label)).toEqual(["2026年1月", "2月"]);
		// 2025-12-20はrangeStart自体であって月初ではないため含まれない
		expect(data.monthMarkers.every((m) => m.pct >= 0 && m.pct <= 100)).toBe(true);
	});
});

describe("buildTimelineRows todayPct", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("today()がrange内なら位置(%)を返す", () => {
		vi.setSystemTime(new Date(2026, 0, 6)); // 2026-01-06 (ローカル)
		const data = buildTimelineRows([makeEntity({ path: "a.md", start: "2026-01-01", due: "2026-01-11" })]);
		expect(data.todayPct).toBeCloseTo(50, 5);
	});

	it("today()がrange外ならnull", () => {
		vi.setSystemTime(new Date(2026, 5, 1)); // 2026-06-01
		const data = buildTimelineRows([makeEntity({ path: "a.md", start: "2026-01-01", due: "2026-01-11" })]);
		expect(data.todayPct).toBeNull();
	});
});
