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
}

export function buildRowMenu(actions: RowMenuActions): Menu {
	const menu = new Menu();
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
