<script lang="ts">
	import { t, type MessageKey } from "../../i18n/ja";
	import type PersonalOSPlugin from "../../main";
	import { isEditableTarget, moveFocus } from "./manageKeyboard";
	import type { ManageRowData, ManageSort, ManageSortKey, ManageTab } from "./manageData";
	import ManageRow from "./ManageRow.svelte";

	let {
		tab,
		rows,
		sort,
		plugin,
		onSortChange,
		onOpen,
		onNavigate,
		showParentColumn = true,
	}: {
		tab: ManageTab;
		rows: ManageRowData[];
		sort: ManageSort;
		plugin: PersonalOSPlugin;
		onSortChange: (key: ManageSortKey) => void;
		onOpen: (path: string) => void;
		onNavigate?: (path: string) => void;
		/** 呼び出し元が既にGoal/Projectでグルーピング済みの場合、冗長な親列を非表示にする(design参照) */
		showParentColumn?: boolean;
	} = $props();

	// キーボード操作(Phase U2): ↑/↓で行フォーカス移動、Enterで詳細/ノートを開く(design §「キーボード操作」)。
	// rowsの中身が変わったら(フィルタ・ソート・reindex)フォーカスは一旦解除する
	let focusedIndex = $state(-1);
	$effect(() => {
		rows;
		focusedIndex = -1;
	});

	function handleKeydown(e: KeyboardEvent): void {
		if (isEditableTarget(e.target as HTMLElement | null)) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			focusedIndex = moveFocus(focusedIndex, rows.length, 1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			focusedIndex = moveFocus(focusedIndex, rows.length, -1);
		} else if (e.key === "Enter") {
			if (focusedIndex < 0 || focusedIndex >= rows.length) return;
			e.preventDefault();
			const entity = rows[focusedIndex].entity;
			if (!entity) return;
			if (onNavigate) onNavigate(entity.path);
			else onOpen(entity.path);
		}
	}

	interface ColumnDef {
		key: ManageSortKey | null;
		labelKey: MessageKey;
		/** Goal/Projectでのグルーピング表示に伴い、showParentColumn=falseの場合は列ごと除外する */
		isParent?: boolean;
	}

	// A3: 各セルはui/components/の共通セルコンポーネントへ置換(ManageRow.svelte参照)。末尾にRowMenu用の列を追加する
	const projectColumns: ColumnDef[] = [
		{ key: "title", labelKey: "manage.column.title" },
		{ key: null, labelKey: "manage.column.status" },
		{ key: null, labelKey: "manage.column.goal", isParent: true },
		{ key: "priority", labelKey: "manage.column.priority" },
		{ key: "progress", labelKey: "manage.column.progress" },
		{ key: "due", labelKey: "manage.column.due" },
		{ key: null, labelKey: "manage.column.labels" },
		{ key: null, labelKey: "manage.column.actions" },
		{ key: null, labelKey: "manage.column.nav" },
	];
	const ticketColumns: ColumnDef[] = [
		{ key: "title", labelKey: "manage.column.title" },
		{ key: null, labelKey: "manage.column.status" },
		{ key: null, labelKey: "manage.column.project", isParent: true },
		{ key: "priority", labelKey: "manage.column.priority" },
		{ key: "progress", labelKey: "manage.column.progress" },
		{ key: "due", labelKey: "manage.column.due" },
		{ key: null, labelKey: "manage.column.labels" },
		{ key: null, labelKey: "manage.column.actions" },
		{ key: null, labelKey: "manage.column.nav" },
	];
	const columns = $derived.by(() => {
		const base = tab === "project" ? projectColumns : ticketColumns;
		return showParentColumn ? base : base.filter((col) => !col.isParent);
	});

	function sortIndicator(key: ManageSortKey | null): string {
		if (!key || sort.key !== key) return "";
		return sort.order === "asc" ? " ▲" : " ▼";
	}

	function rowKey(row: ManageRowData): string {
		return row.entity.path;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -- 行フォーカス移動(↑/↓/Enter)のための複合ウィジェットコンテナ(design: キーボード操作) -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pos-manage-table-wrapper" role="grid" tabindex="0" onkeydown={handleKeydown}>
	<table class="pos-manage-table" class:pos-manage-table-no-parent={!showParentColumn}>
		<thead>
			<tr>
				{#each columns as col (col.labelKey)}
					<th class:pos-manage-th-sortable={!!col.key} onclick={() => col.key && onSortChange(col.key)}>
						{t(col.labelKey)}{sortIndicator(col.key)}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if rows.length === 0}
				<tr>
					<td class="pos-manage-empty" colspan={columns.length}>{t("manage.emptyState")}</td>
				</tr>
			{:else}
				{#each rows as row, i (rowKey(row))}
					<ManageRow {row} {tab} {plugin} {onOpen} {onNavigate} {showParentColumn} focused={i === focusedIndex} />
				{/each}
			{/if}
		</tbody>
	</table>
</div>
