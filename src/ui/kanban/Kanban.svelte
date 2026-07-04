<script lang="ts">
	import { Notice } from "obsidian";
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { makeProjectDetailScreen, makeTicketDetailScreen, resolveNavigateAction } from "../manage/manageNav";
	import { moveEntityStatus, type KanbanData, type KanbanMode } from "./kanbanData";
	import KanbanColumn from "./KanbanColumn.svelte";

	let {
		plugin,
		data,
		onRefresh,
		onModeChange,
	}: {
		plugin: PersonalOSPlugin;
		data: Writable<KanbanData>;
		onRefresh: () => void;
		onModeChange: (mode: KanbanMode) => void;
	} = $props();

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	/**
	 * カード本体クリック時の遷移(design-drilldown-nav.md §4.1と同じ操作言語)。
	 * KanbanのentityはTicket/Projectのみのため、修飾クリック時以外は必ず管理View詳細へ遷移する。
	 */
	function navigate(path: string, modifierClick: boolean): void {
		const entity = plugin.store.get(path);
		const action = resolveNavigateAction(entity?.type, modifierClick);
		if (action === "project-detail") {
			void plugin.openManageAt(makeProjectDetailScreen(path));
			return;
		}
		if (action === "ticket-detail") {
			void plugin.openManageAt(makeTicketDetailScreen(path));
			return;
		}
		openPath(path);
	}

	/** 楽観的更新: 即時にUIを移動 → 失敗時は元の状態へ戻す(detail-design.md §5.3) */
	async function move(path: string, status: string): Promise<void> {
		const prev = $data;
		data.set(moveEntityStatus(prev, path, status));
		try {
			await plugin.entityService.changeStatus(path, status);
		} catch {
			data.set(prev);
			new Notice(t("kanban.moveFailed"));
		}
	}

	function handleDrop(status: string, event: DragEvent): void {
		event.preventDefault();
		const path = event.dataTransfer?.getData("text/plain");
		if (path) void move(path, status);
	}

	const statuses = $derived($data.columns.map((c) => c.status));
	const columnNames = $derived(Object.fromEntries($data.columns.map((c) => [c.status, c.label])));
</script>

<div class="pos-kanban">
	<div class="pos-kanban-header">
		<h2 class="pos-kanban-title">{t("kanban.title")}</h2>
		<div class="pos-kanban-toggle">
			<button
				class="pos-kanban-toggle-btn"
				class:pos-kanban-toggle-active={$data.mode === "ticket"}
				onclick={() => onModeChange("ticket")}
			>
				{t("kanban.modeTicket")}
			</button>
			<button
				class="pos-kanban-toggle-btn"
				class:pos-kanban-toggle-active={$data.mode === "project"}
				onclick={() => onModeChange("project")}
			>
				{t("kanban.modeProject")}
			</button>
		</div>
		<button class="pos-dashboard-refresh" onclick={onRefresh} aria-label={t("dashboard.refresh")}>
			{t("dashboard.refresh")}
		</button>
	</div>

	<div class="pos-kanban-columns">
		{#each $data.columns as column (column.status)}
			<KanbanColumn
				{plugin}
				status={column.status}
				label={column.label}
				entities={column.entities}
				{statuses}
				{columnNames}
				onNavigate={navigate}
				onOpenNote={openPath}
				onMove={move}
				onDrop={handleDrop}
			/>
		{/each}
	</div>
</div>
