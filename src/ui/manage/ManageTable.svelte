<script lang="ts">
	import { t, type MessageKey } from "../../i18n/ja";
	import type PersonalOSPlugin from "../../main";
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
	}: {
		tab: ManageTab;
		rows: ManageRowData[];
		sort: ManageSort;
		plugin: PersonalOSPlugin;
		onSortChange: (key: ManageSortKey) => void;
		onOpen: (path: string) => void;
		onNavigate?: (path: string) => void;
	} = $props();

	interface ColumnDef {
		key: ManageSortKey | null;
		labelKey: MessageKey;
	}

	// A3: 各セルはui/components/の共通セルコンポーネントへ置換(ManageRow.svelte参照)。末尾にRowMenu用の列を追加する
	const projectColumns: ColumnDef[] = [
		{ key: "title", labelKey: "manage.column.title" },
		{ key: null, labelKey: "manage.column.status" },
		{ key: null, labelKey: "manage.column.goal" },
		{ key: "priority", labelKey: "manage.column.priority" },
		{ key: "progress", labelKey: "manage.column.progress" },
		{ key: "due", labelKey: "manage.column.due" },
		{ key: null, labelKey: "manage.column.labels" },
		{ key: null, labelKey: "manage.column.actions" },
	];
	const ticketColumns: ColumnDef[] = [
		{ key: "title", labelKey: "manage.column.title" },
		{ key: null, labelKey: "manage.column.status" },
		{ key: null, labelKey: "manage.column.project" },
		{ key: "priority", labelKey: "manage.column.priority" },
		{ key: "progress", labelKey: "manage.column.progress" },
		{ key: "due", labelKey: "manage.column.due" },
		{ key: null, labelKey: "manage.column.labels" },
		{ key: null, labelKey: "manage.column.actions" },
	];
	const columns = $derived(tab === "project" ? projectColumns : ticketColumns);

	function sortIndicator(key: ManageSortKey | null): string {
		if (!key || sort.key !== key) return "";
		return sort.order === "asc" ? " ▲" : " ▼";
	}

	function rowKey(row: ManageRowData): string {
		return row.entity.path;
	}
</script>

<table class="pos-manage-table">
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
			{#each rows as row (rowKey(row))}
				<ManageRow {row} {tab} {plugin} {onOpen} {onNavigate} />
			{/each}
		{/if}
	</tbody>
</table>
