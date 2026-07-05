import { describe, expect, it, vi } from "vitest";
import { buildTodoMenu, type TodoMenuActions } from "../../src/ui/components/todoMenuBuilder";
import type { MenuEntry } from "../mocks/obsidian";

function baseActions(overrides: Partial<TodoMenuActions> = {}): TodoMenuActions {
	return {
		priorityOptions: [],
		onChangePriority: vi.fn(),
		onSetDueDate: vi.fn(),
		onEditText: vi.fn(),
		moveUpDisabled: false,
		onMoveUp: vi.fn(),
		moveDownDisabled: false,
		onMoveDown: vi.fn(),
		onPromote: vi.fn(),
		onDelete: vi.fn(),
		...overrides,
	};
}

// buildTodoMenu()はobsidian実型のMenuを返すが、tests/mocks/obsidian.tsのMenuへ実行時差し替えされている
// (vitest.config.tsのresolve.alias)。tsc(実obsidian型)向けにitemsへアクセスするためのキャスト。
function menuItems(menu: ReturnType<typeof buildTodoMenu>): MenuEntry[] {
	return (menu as unknown as { items: MenuEntry[] }).items;
}

describe("buildTodoMenu priority section", () => {
	it("does not render a priority section when priorityOptions is empty", () => {
		const menu = buildTodoMenu(baseActions());
		expect(menuItems(menu).every((entry) => entry.type !== "item" || !entry.title.startsWith("優先度:"))).toBe(true);
	});

	it("renders priority candidates prefixed with 優先度:, followed by a separator, before the due date item", () => {
		const onChangePriority = vi.fn();
		const menu = buildTodoMenu(
			baseActions({
				priorityOptions: [
					{ value: "high", label: "high" },
					{ value: "", label: "(未設定)" },
				],
				onChangePriority,
			})
		);

		expect(menuItems(menu)[0]).toMatchObject({ type: "item", title: "優先度: high" });
		expect(menuItems(menu)[1]).toMatchObject({ type: "item", title: "優先度: (未設定)" });
		expect(menuItems(menu)[2]).toEqual({ type: "separator" });
		expect(menuItems(menu)[3]).toMatchObject({ type: "item", title: "期限を設定…" });
	});

	it("invokes onChangePriority with the option's value when a priority item is clicked", () => {
		const onChangePriority = vi.fn();
		const menu = buildTodoMenu(
			baseActions({
				priorityOptions: [{ value: "low", label: "low" }],
				onChangePriority,
			})
		);

		const priorityItem = menuItems(menu).find((entry) => entry.type === "item" && entry.title === "優先度: low");
		expect(priorityItem?.type).toBe("item");
		(priorityItem as { onClick?: () => void }).onClick?.();
		expect(onChangePriority).toHaveBeenCalledWith("low");
	});
});

describe("buildTodoMenu due date item", () => {
	it("invokes onSetDueDate when clicked", () => {
		const onSetDueDate = vi.fn();
		const menu = buildTodoMenu(baseActions({ onSetDueDate }));
		const item = menuItems(menu).find((entry) => entry.type === "item" && entry.title === "期限を設定…");
		expect(item?.type).toBe("item");
		(item as { onClick?: () => void }).onClick?.();
		expect(onSetDueDate).toHaveBeenCalled();
	});
});

describe("buildTodoMenu overall structure", () => {
	it("renders editText/moveUp/moveDown/promote after the due date item, then delete last", () => {
		const menu = buildTodoMenu(baseActions());
		const titles = menuItems(menu).map((entry) => (entry.type === "item" ? entry.title : "---"));
		expect(titles).toEqual([
			"期限を設定…",
			"---",
			"テキストを編集",
			"上へ移動",
			"下へ移動",
			"昇格",
			"---",
			"削除",
		]);
	});

	it("disables moveUp/moveDown according to the given flags", () => {
		const menu = buildTodoMenu(baseActions({ moveUpDisabled: true, moveDownDisabled: false }));
		const moveUp = menuItems(menu).find((entry) => entry.type === "item" && entry.title === "上へ移動");
		const moveDown = menuItems(menu).find((entry) => entry.type === "item" && entry.title === "下へ移動");
		expect(moveUp).toMatchObject({ disabled: true });
		expect(moveDown).toMatchObject({ disabled: false });
	});
});
