import { describe, expect, it, vi } from "vitest";
import { buildRowMenu, type RowMenuActions } from "../../src/ui/components/rowMenuBuilder";
import type { MenuEntry } from "../mocks/obsidian";

function baseActions(overrides: Partial<RowMenuActions> = {}): RowMenuActions {
	return {
		onOpenNote: vi.fn(),
		onShowPreview: vi.fn(),
		onDelete: vi.fn(),
		...overrides,
	};
}

// buildRowMenu()はobsidian実型のMenuを返すが、tests/mocks/obsidian.tsのMenuへ実行時差し替えされている
// (vitest.config.tsのresolve.alias)。tsc(実obsidian型)向けにitemsへアクセスするためのキャスト。
function menuItems(menu: ReturnType<typeof buildRowMenu>): MenuEntry[] {
	return (menu as unknown as { items: MenuEntry[] }).items;
}

describe("buildRowMenu status section", () => {
	it("does not render a status section when statusOptions/onChangeStatus are absent", () => {
		const menu = buildRowMenu(baseActions());
		expect(menuItems(menu).every((entry) => entry.type !== "item" || !entry.title.startsWith("▸"))).toBe(true);
	});

	it("does not render a status section when statusOptions is empty", () => {
		const menu = buildRowMenu(baseActions({ statusOptions: [], onChangeStatus: vi.fn() }));
		expect(menuItems(menu).every((entry) => entry.type !== "item" || !entry.title.startsWith("▸"))).toBe(true);
	});

	it("renders status candidates at the top, each prefixed with ▸, followed by a separator", () => {
		const onChangeStatus = vi.fn();
		const menu = buildRowMenu(
			baseActions({
				statusOptions: [
					{ value: "ready", label: "対応待ち" },
					{ value: "doing", label: "進行中" },
				],
				onChangeStatus,
			})
		);

		expect(menuItems(menu)[0]).toMatchObject({ type: "item", title: "▸ 対応待ち" });
		expect(menuItems(menu)[1]).toMatchObject({ type: "item", title: "▸ 進行中" });
		expect(menuItems(menu)[2]).toEqual({ type: "separator" });
		// 既存の先頭項目(ノートを開く)はステータス欄より後に続く
		expect(menuItems(menu)[3]).toMatchObject({ type: "item", title: "ノートを開く" });
	});

	it("invokes onChangeStatus with the option's value when a status item is clicked", () => {
		const onChangeStatus = vi.fn();
		const menu = buildRowMenu(
			baseActions({
				statusOptions: [{ value: "doing", label: "進行中" }],
				onChangeStatus,
			})
		);

		const statusItem = menuItems(menu).find((entry) => entry.type === "item" && entry.title === "▸ 進行中");
		expect(statusItem?.type).toBe("item");
		(statusItem as { onClick?: () => void }).onClick?.();
		expect(onChangeStatus).toHaveBeenCalledWith("doing");
	});

	it("still renders delete as the last item regardless of the status section", () => {
		const menu = buildRowMenu(
			baseActions({
				statusOptions: [{ value: "doing", label: "進行中" }],
				onChangeStatus: vi.fn(),
			})
		);
		expect(menuItems(menu).at(-1)).toMatchObject({ type: "item", title: "削除" });
	});
});
