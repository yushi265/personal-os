<script lang="ts">
	import { t } from "../../i18n/ja";
	import { buildRowMenu, type RowMenuActions } from "./rowMenuBuilder";

	/**
	 * 行末「⋮」メニュー(design-ui-first.md §3.1)。メニュー内容自体はrowMenuBuilder.tsに一本化していて、
	 * モバイルの長押し検出(ManageRow.svelte)からも同じ内容を出す。
	 * onPromote/onArchiveをundefinedにすると当該項目自体を出さない(Projectには昇格が無い、Todoにはarchiveが無い等)。
	 */
	let props: RowMenuActions = $props();

	function openMenu(e: MouseEvent): void {
		e.stopPropagation();
		buildRowMenu(props).showAtMouseEvent(e);
	}
</script>

<button class="pos-manage-row-menu-btn" onclick={openMenu} aria-label={t("manage.rowMenu.label")}>⋮</button>
