import { describe, expect, it } from "vitest";
import { addCycle, addDays, describeDue, nowStamp, today } from "../../src/domain/date";

describe("today", () => {
	it("returns a YYYY-MM-DD formatted string", () => {
		expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("nowStamp", () => {
	it("returns a YYYY-MM-DD HH:mm formatted string", () => {
		expect(nowStamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	});

	it("shares the same date part as today()", () => {
		expect(nowStamp().startsWith(today())).toBe(true);
	});
});

describe("addCycle", () => {
	it("adds a day for daily", () => {
		expect(addCycle("2026-07-04", "daily")).toBe("2026-07-05");
	});

	it("adds a week for weekly", () => {
		expect(addCycle("2026-07-04", "weekly")).toBe("2026-07-11");
	});

	it("adds a month for monthly", () => {
		expect(addCycle("2026-07-04", "monthly")).toBe("2026-08-04");
	});

	it("adds three months for quarterly", () => {
		expect(addCycle("2026-07-04", "quarterly")).toBe("2026-10-04");
	});

	it("adds a year for yearly", () => {
		expect(addCycle("2026-07-04", "yearly")).toBe("2027-07-04");
	});

	it("rolls over month-end per JS Date semantics for monthly", () => {
		const result = addCycle("2026-01-31", "monthly");
		// JS Date: 2026-01-31 + 1 month → 2026-03-03 (Feb has 28 days in 2026)
		const expected = new Date(2026, 0, 31);
		expected.setMonth(expected.getMonth() + 1);
		const y = expected.getFullYear();
		const m = String(expected.getMonth() + 1).padStart(2, "0");
		const d = String(expected.getDate()).padStart(2, "0");
		expect(result).toBe(`${y}-${m}-${d}`);
	});

	it("rolls over correctly for a leap-year February", () => {
		// 2028 is a leap year
		const result = addCycle("2028-01-31", "monthly");
		const expected = new Date(2028, 0, 31);
		expected.setMonth(expected.getMonth() + 1);
		const y = expected.getFullYear();
		const m = String(expected.getMonth() + 1).padStart(2, "0");
		const d = String(expected.getDate()).padStart(2, "0");
		expect(result).toBe(`${y}-${m}-${d}`);
	});
});

describe("addDays", () => {
	it("adds days within the same month", () => {
		expect(addDays("2026-07-04", 3)).toBe("2026-07-07");
	});

	it("rolls over into the next month", () => {
		expect(addDays("2026-07-28", 5)).toBe("2026-08-02");
	});

	it("rolls over into the next year", () => {
		expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
	});

	it("supports negative n (subtracting days)", () => {
		expect(addDays("2026-07-04", -5)).toBe("2026-06-29");
	});
});

describe("describeDue", () => {
	it("D-1: labels a past due date as overdue with the day count", () => {
		expect(describeDue("2026-07-01", "2026-07-04")).toEqual({ label: "3日超過", tone: "overdue" });
	});

	it("D-2: labels a 1-day-overdue date correctly", () => {
		expect(describeDue("2026-07-03", "2026-07-04")).toEqual({ label: "1日超過", tone: "overdue" });
	});

	it("D-3: labels the same day as today", () => {
		expect(describeDue("2026-07-04", "2026-07-04")).toEqual({ label: "今日", tone: "today" });
	});

	it("D-4: labels 1 day ahead as soon", () => {
		expect(describeDue("2026-07-05", "2026-07-04")).toEqual({ label: "1日後", tone: "soon" });
	});

	it("D-5: labels exactly 3 days ahead as soon (boundary)", () => {
		expect(describeDue("2026-07-07", "2026-07-04")).toEqual({ label: "3日後", tone: "soon" });
	});

	it("D-6: labels 4 days ahead as normal (just past the soon boundary)", () => {
		expect(describeDue("2026-07-08", "2026-07-04")).toEqual({ label: "4日後", tone: "normal" });
	});

	it("D-7: rolls over month boundaries correctly when computing the day diff", () => {
		expect(describeDue("2026-08-01", "2026-07-30")).toEqual({ label: "2日後", tone: "soon" });
	});
});
