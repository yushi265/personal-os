import { describe, expect, it } from "vitest";
import { addCycle, addDays, today } from "../../src/domain/date";

describe("today", () => {
	it("returns a YYYY-MM-DD formatted string", () => {
		expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
