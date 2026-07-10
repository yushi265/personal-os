import { describe, expect, it } from "vitest";
import { statusColorClass } from "../../../src/ui/components/badgeStyles";

describe("statusColorClass", () => {
	it("maps cancelled to the same class as done/archived (POS-3 AC-3 badge)", () => {
		expect(statusColorClass("cancelled")).toBe("pos-status-done");
	});
});
