<script lang="ts">
	import { Notice } from "obsidian";
	import { computeOrderForInsert } from "../../domain/entity";
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
		onCrossDrop,
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
		/**
		 * D&D中に、このテーブルの`rows`に属さないpathがドロップされた場合(Goal跨ぎドロップ、design-reorder-and-notes.md A-4)。
		 * 未指定(このテーブル自体がGoalグルーピングされていない画面)の場合はドロップを無視する。
		 */
		onCrossDrop?: (path: string, targetIndex: number, position: "before" | "after") => void;
	} = $props();

	// D&D並び替え(design-reorder-and-notes.md A-4, F2-2): manualソート時のみドラッグ有効
	let dragOverIndex = $state<number | null>(null);
	let insertPosition = $state<"before" | "after" | null>(null);

	function handleDragStart(event: DragEvent, path: string): void {
		event.dataTransfer?.setData("text/plain", path);
	}

	function handleDragOver(event: DragEvent, index: number): void {
		if (sort.key !== "manual") return;
		event.preventDefault();
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const midpoint = rect.top + rect.height / 2;
		insertPosition = event.clientY < midpoint ? "before" : "after";
		dragOverIndex = index;
	}

	function handleDragLeave(index: number): void {
		if (dragOverIndex === index) dragOverIndex = null;
	}

	/** fromIndex(移動元)を除去した後の配列に対するtoIndexへ変換する(Array.splice remove-then-insert方式) */
	function toPostRemovalIndex(fromIndex: number, rawToIndex: number): number {
		return rawToIndex > fromIndex ? rawToIndex - 1 : rawToIndex;
	}

	async function applyReorder(fromIndex: number, toIndex: number): Promise<void> {
		const orderRows = rows.map((r) => ({ path: r.entity.path, order: r.entity.order }));
		const changes = computeOrderForInsert(orderRows, fromIndex, toIndex);
		try {
			for (const change of changes) {
				await plugin.entityFieldService.reorder(change.path, change.order);
			}
		} catch {
			new Notice(t("manage.updateFailed"));
		}
	}

	function handleRowDrop(event: DragEvent, targetIndex: number): void {
		event.preventDefault();
		const path = event.dataTransfer?.getData("text/plain");
		const position = insertPosition ?? "before";
		dragOverIndex = null;
		insertPosition = null;
		if (!path) return;

		const fromIndex = rows.findIndex((r) => r.entity.path === path);
		if (fromIndex === -1) {
			onCrossDrop?.(path, targetIndex, position);
			return;
		}
		const rawToIndex = position === "after" ? targetIndex + 1 : targetIndex;
		const toIndex = toPostRemovalIndex(fromIndex, rawToIndex);
		void applyReorder(fromIndex, toIndex);
	}

	/** モバイル代替(design-reorder-and-notes.md A-5): RowMenuの「上へ移動」「下へ移動」 */
	function moveEntity(path: string, direction: "up" | "down"): void {
		const fromIndex = rows.findIndex((r) => r.entity.path === path);
		if (fromIndex === -1) return;
		const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
		if (toIndex < 0 || toIndex > rows.length - 1) return;
		void applyReorder(fromIndex, toIndex);
	}

	function resetToManual(): void {
		onSortChange("manual");
	}

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
	// 先頭のドラッグハンドル列(design-reorder-and-notes.md A-4)は全タブ共通のためcolumnsとは別にthead側で1個だけ描画する
	const projectColumns: ColumnDef[] = [
		{ key: "title", labelKey: "manage.column.title" },
		{ key: "status", labelKey: "manage.column.status" },
		{ key: "priority", labelKey: "manage.column.priority" },
		{ key: "progress", labelKey: "manage.column.progress" },
		{ key: "due", labelKey: "manage.column.due" },
		{ key: null, labelKey: "manage.column.labels" },
		{ key: null, labelKey: "manage.column.actions" },
		{ key: null, labelKey: "manage.column.nav" },
	];
	const ticketColumns: ColumnDef[] = [
		{ key: "title", labelKey: "manage.column.title" },
		{ key: "status", labelKey: "manage.column.status" },
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
		if (!key || sort.key === "manual" || sort.key !== key) return ""; // manual時は方向概念が無いため常に非表示
		return sort.order === "asc" ? " ▲" : " ▼";
	}

	function rowKey(row: ManageRowData): string {
		return row.entity.path;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -- 行フォーカス移動(↑/↓/Enter)のための複合ウィジェットコンテナ(design: キーボード操作) -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pos-manage-table-wrapper" role="grid" tabindex="0" onkeydown={handleKeydown}>
	{#if sort.key !== "manual"}
		<button type="button" class="pos-manage-reset-manual-btn" onclick={resetToManual}>
			{t("manage.reorder.resetToManual")}
		</button>
	{/if}
	<table class="pos-manage-table" class:pos-manage-table-no-parent={!showParentColumn}>
		<thead>
			<tr>
				<th class="pos-manage-th-drag"></th>
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
					<td class="pos-manage-empty" colspan={columns.length + 1}>{t("manage.emptyState")}</td>
				</tr>
			{:else}
				{#each rows as row, i (rowKey(row))}
					<ManageRow
						{row}
						{tab}
						{plugin}
						{sort}
						{onOpen}
						{onNavigate}
						{showParentColumn}
						focused={i === focusedIndex}
						dragInsertBefore={dragOverIndex === i && insertPosition === "before"}
						dragInsertAfter={dragOverIndex === i && insertPosition === "after"}
						onDragStartRow={(e) => handleDragStart(e, row.entity.path)}
						onDragOverRow={(e) => handleDragOver(e, i)}
						onDragLeaveRow={() => handleDragLeave(i)}
						onDropRow={(e) => handleRowDrop(e, i)}
						onMoveUp={() => moveEntity(row.entity.path, "up")}
						onMoveDown={() => moveEntity(row.entity.path, "down")}
					/>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
