import { Menu } from "obsidian";
import { t } from "../../i18n/ja";

/**
 * 行の「⋮」メニュー(design-ui-first.md §3.1)の項目定義。RowMenu.svelte(⋮ボタン)と
 * ManageRow.svelteの長押し検出(モバイル、design-reorder-and-notes.md)の両方から同じ内容を出すための
 * 共有ビルダー。二重実装を避けるため、Menu構築ロジックはここに一本化する。
 */
export interface RowMenuActions {
	onOpenNote: () => void;
	onShowPreview: () => void;
	onRename?: () => void;
	onPromote?: () => void;
	onArchive?: () => void;
	/** Goal/Project再割り当て(一覧行からの導線、ParentCellが無い画面向け)。changeParentLabelとセットで指定する */
	onChangeParent?: () => void;
	changeParentLabel?: string;
	/**
	 * モバイル代替(design-reorder-and-notes.md A-5): D&D不可環境向けに「⋮」メニューへ常時表示する
	 * (Platform.isMobileでのゲーティングはしない方針で承認済み)。
	 */
	onMoveUp?: () => void;
	onMoveDown?: () => void;
	onDelete: () => void;
	/**
	 * ステータス変更(長押し/⋮メニューへのステータス変更追加): 現在値とarchivedを除いた候補一覧。
	 * KanbanCard.svelteの⋮メニューと表示形式(「▸ ラベル」/現在値は候補から除く)を揃えている。
	 * 空配列またはundefinedならセクション自体を出さない。
	 */
	statusOptions?: { value: string; label: string }[];
	onChangeStatus?: (next: string) => void;
	/**
	 * 優先度変更(長押し/⋮メニューへの優先度変更追加): 現在値を除いた候補一覧。ステータス項目(「▸ ラベル」)と
	 * 視覚的に区別するため「優先度: ラベル」プレフィックスにする。空配列またはundefinedならセクション自体を出さない。
	 */
	priorityOptions?: { value: string; label: string }[];
	onChangePriority?: (next: string) => void;
}

export function buildRowMenu(actions: RowMenuActions): Menu {
	const menu = new Menu();
	if (actions.onChangeStatus && actions.statusOptions && actions.statusOptions.length > 0) {
		for (const option of actions.statusOptions) {
			menu.addItem((item) =>
				item.setTitle(`▸ ${option.label}`).onClick(() => actions.onChangeStatus!(option.value))
			);
		}
		menu.addSeparator();
	}
	if (actions.onChangePriority && actions.priorityOptions && actions.priorityOptions.length > 0) {
		for (const option of actions.priorityOptions) {
			menu.addItem((item) =>
				item.setTitle(`優先度: ${option.label}`).onClick(() => actions.onChangePriority!(option.value))
			);
		}
		menu.addSeparator();
	}
	menu.addItem((item) => item.setTitle(t("manage.rowMenu.openNote")).onClick(actions.onOpenNote));
	menu.addItem((item) => item.setTitle(t("manage.rowMenu.showPreview")).onClick(actions.onShowPreview));
	if (actions.onRename) {
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.rename")).onClick(actions.onRename!));
	}
	if (actions.onPromote) {
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.promote")).onClick(actions.onPromote!));
	}
	if (actions.onChangeParent && actions.changeParentLabel) {
		menu.addItem((item) => item.setTitle(actions.changeParentLabel!).onClick(actions.onChangeParent!));
	}
	if (actions.onMoveUp) {
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.moveUp")).onClick(actions.onMoveUp!));
	}
	if (actions.onMoveDown) {
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.moveDown")).onClick(actions.onMoveDown!));
	}
	if (actions.onArchive) {
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.archive")).onClick(actions.onArchive!));
	}
	menu.addSeparator();
	menu.addItem((item) => item.setTitle(t("manage.rowMenu.delete")).onClick(actions.onDelete));
	return menu;
}
