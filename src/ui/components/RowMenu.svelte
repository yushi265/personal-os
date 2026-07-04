<script lang="ts">
	import { Menu } from "obsidian";
	import { t } from "../../i18n/ja";

	/**
	 * 行末「⋮」メニュー(design-ui-first.md §3.1)。KanbanCard.svelteのMenu実装パターンを踏襲する。
	 * onPromote/onArchiveをundefinedにすると当該項目自体を出さない(Projectには昇格が無い、Todoにはarchiveが無い等)。
	 */
	let {
		onOpenNote,
		onShowPreview,
		onRename,
		onPromote,
		onArchive,
		onChangeParent,
		changeParentLabel,
		onMoveUp,
		onMoveDown,
		onDelete,
	}: {
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
	} = $props();

	function openMenu(e: MouseEvent): void {
		e.stopPropagation();
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.openNote")).onClick(onOpenNote));
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.showPreview")).onClick(onShowPreview));
		if (onRename) {
			menu.addItem((item) => item.setTitle(t("manage.rowMenu.rename")).onClick(onRename));
		}
		if (onPromote) {
			menu.addItem((item) => item.setTitle(t("manage.rowMenu.promote")).onClick(onPromote));
		}
		if (onChangeParent && changeParentLabel) {
			menu.addItem((item) => item.setTitle(changeParentLabel).onClick(onChangeParent));
		}
		if (onMoveUp) {
			menu.addItem((item) => item.setTitle(t("manage.rowMenu.moveUp")).onClick(onMoveUp));
		}
		if (onMoveDown) {
			menu.addItem((item) => item.setTitle(t("manage.rowMenu.moveDown")).onClick(onMoveDown));
		}
		if (onArchive) {
			menu.addItem((item) => item.setTitle(t("manage.rowMenu.archive")).onClick(onArchive));
		}
		menu.addSeparator();
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.delete")).onClick(onDelete));
		menu.showAtMouseEvent(e);
	}
</script>

<button class="pos-manage-row-menu-btn" onclick={openMenu} aria-label={t("manage.rowMenu.label")}>⋮</button>
