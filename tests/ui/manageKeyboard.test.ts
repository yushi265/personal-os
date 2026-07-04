import { describe, expect, it } from "vitest";
import { isEditableTarget, moveFocus } from "../../src/ui/manage/manageKeyboard";

describe("moveFocus", () => {
	it("空リストでは常に-1を返す", () => {
		expect(moveFocus(-1, 0, 1)).toBe(-1);
		expect(moveFocus(-1, 0, -1)).toBe(-1);
		expect(moveFocus(2, 0, 1)).toBe(-1);
	});

	it("未フォーカス(-1)から↓は先頭、↑は末尾へ入る", () => {
		expect(moveFocus(-1, 3, 1)).toBe(0);
		expect(moveFocus(-1, 3, -1)).toBe(2);
	});

	it("先頭で↑は先頭のまま(ループしない)", () => {
		expect(moveFocus(0, 3, -1)).toBe(0);
	});

	it("末尾で↓は末尾のまま(ループしない)", () => {
		expect(moveFocus(2, 3, 1)).toBe(2);
	});

	it("中間では通常通り前後に移動する", () => {
		expect(moveFocus(1, 3, 1)).toBe(2);
		expect(moveFocus(1, 3, -1)).toBe(0);
	});
});

describe("isEditableTarget", () => {
	it("null/undefinedはfalse", () => {
		expect(isEditableTarget(null)).toBe(false);
		expect(isEditableTarget(undefined)).toBe(false);
	});

	it("input/textarea/selectはtrue", () => {
		expect(isEditableTarget({ tagName: "input" })).toBe(true);
		expect(isEditableTarget({ tagName: "TEXTAREA" })).toBe(true);
		expect(isEditableTarget({ tagName: "select" })).toBe(true);
	});

	it("contenteditableはtrue", () => {
		expect(isEditableTarget({ tagName: "div", isContentEditable: true })).toBe(true);
	});

	it("通常の要素はfalse", () => {
		expect(isEditableTarget({ tagName: "div" })).toBe(false);
		expect(isEditableTarget({ tagName: "button" })).toBe(false);
	});
});
