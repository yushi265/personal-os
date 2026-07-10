import { Menu } from "obsidian";
import { t } from "../../i18n/ja";

/**
 * Todo行のモバイル長押しメニュー(TodoList.svelte)の項目定義。
 * rowMenuBuilder.ts(ManageRow.svelte向け)と同じ理由で、Menu構築ロジックを単体テスト可能にするため分離する。
 */
export interface TodoMenuActions {
	/** 優先度候補(現在値を除いたもの)。空配列なら優先度セクションを出さない */
	priorityOptions: { value: string; label: string }[];
	onChangePriority: (next: string) => void;
	onSetDueDate: () => void;
	onEditText: () => void;
	moveUpDisabled: boolean;
	onMoveUp: () => void;
	moveDownDisabled: boolean;
	onMoveDown: () => void;
	onPromote: () => void;
	/** true: 現在cancelled状態(「キャンセル解除」項目を出す) / false: open・done状態(「キャンセル」項目を出す) */
	isCancelled: boolean;
	onCancel: () => void;
	onDelete: () => void;
}

export function buildTodoMenu(actions: TodoMenuActions): Menu {
	const menu = new Menu();
	if (actions.priorityOptions.length > 0) {
		for (const option of actions.priorityOptions) {
			menu.addItem((item) =>
				item.setTitle(`優先度: ${option.label}`).onClick(() => actions.onChangePriority(option.value))
			);
		}
		menu.addSeparator();
	}
	menu.addItem((item) => item.setTitle(t("preview.todo.setDueDate")).onClick(actions.onSetDueDate));
	menu.addSeparator();
	menu.addItem((item) => item.setTitle(t("preview.todo.editText")).onClick(actions.onEditText));
	menu.addItem((item) =>
		item.setTitle(t("preview.todo.moveUp")).setDisabled(actions.moveUpDisabled).onClick(actions.onMoveUp)
	);
	menu.addItem((item) =>
		item.setTitle(t("preview.todo.moveDown")).setDisabled(actions.moveDownDisabled).onClick(actions.onMoveDown)
	);
	menu.addItem((item) => item.setTitle(t("preview.todo.promote")).onClick(actions.onPromote));
	menu.addItem((item) =>
		item.setTitle(t(actions.isCancelled ? "preview.todo.uncancel" : "preview.todo.cancel")).onClick(actions.onCancel)
	);
	menu.addSeparator();
	menu.addItem((item) => item.setTitle(t("preview.todo.delete")).onClick(actions.onDelete));
	return menu;
}
