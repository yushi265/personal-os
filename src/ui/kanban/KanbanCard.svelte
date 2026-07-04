<script lang="ts">
	import { Menu, Platform } from "obsidian";
	import type { Entity } from "../../domain/entity";
	import { t } from "../../i18n/ja";

	let {
		entity,
		statuses,
		columnNames,
		onOpen,
		onMove,
	}: {
		entity: Entity;
		statuses: readonly string[];
		columnNames: Record<string, string>;
		onOpen: (path: string) => void;
		onMove: (path: string, status: string) => void;
	} = $props();

	function handleDragStart(e: DragEvent): void {
		e.dataTransfer?.setData("text/plain", entity.path);
	}

	function openStatusMenu(e: MouseEvent): void {
		e.stopPropagation();
		const menu = new Menu();
		for (const status of statuses) {
			menu.addItem((item) =>
				item.setTitle(columnNames[status] ?? status).onClick(() => onMove(entity.path, status))
			);
		}
		menu.showAtMouseEvent(e);
	}
</script>

<div
	class="pos-kanban-card"
	draggable={!Platform.isMobile}
	ondragstart={handleDragStart}
	onclick={() => onOpen(entity.path)}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === "Enter" && onOpen(entity.path)}
>
	<div class="pos-kanban-card-title">{entity.title}</div>
	<div class="pos-kanban-card-meta">
		{#if entity.priority}
			<span class="pos-kanban-badge pos-kanban-badge-{entity.priority}">{entity.priority}</span>
		{/if}
		{#if entity.due}
			<span class="pos-widget-due">📅 {entity.due}</span>
		{/if}
		{#if entity.blockers.length > 0}
			<span class="pos-kanban-badge pos-kanban-badge-blocked">⛔</span>
		{/if}
	</div>
	{#if entity.type !== "goal"}
		<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
			<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
		</div>
	{/if}
	{#if Platform.isMobile}
		<button class="pos-kanban-card-menu" onclick={openStatusMenu} aria-label={t("kanban.moveStatus")}>⋮</button>
	{/if}
</div>
