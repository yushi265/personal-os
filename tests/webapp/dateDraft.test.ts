import { describe, expect, it } from "vitest";
import { initialDateDraft } from "../../webapp/src/lib/dateDraft";

describe("initialDateDraft", () => {
	it("[同値分割] value=undefined → today(未設定はtodayをデフォルト)", () => {
		expect(initialDateDraft(undefined, "2026-07-08")).toBe("2026-07-08");
	});

	it("[境界値] value=\"\"(空文字) → today", () => {
		expect(initialDateDraft("", "2026-07-08")).toBe("2026-07-08");
	});

	it("[同値分割] value=既存日付 → そのまま(既存値は保持)", () => {
		expect(initialDateDraft("2026-01-02", "2026-07-08")).toBe("2026-01-02");
	});
});
