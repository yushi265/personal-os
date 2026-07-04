<script lang="ts">
	import type { Entity } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import KanbanCard from "./KanbanCard.svelte";

	let {
		plugin,
		status,
		label,
		entities,
		statuses,
		columnNames,
		onNavigate,
		onOpenNote,
		onMove,
		onDrop,
	}: {
		plugin: PersonalOSPlugin;
		status: string;
		label: string;
		entities: Entity[];
		statuses: readonly string[];
		columnNames: Record<string, string>;
		onNavigate: (path: string, modifierClick: boolean) => void;
		onOpenNote: (path: string) => void;
		onMove: (path: string, status: string) => void;
		onDrop: (status: string, event: DragEvent) => void;
	} = $props();

	let dragOver = $state(false);

	function handleDragOver(e: DragEvent): void {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(): void {
		dragOver = false;
	}

	function handleDrop(e: DragEvent): void {
		dragOver = false;
		onDrop(status, e);
	}
</script>

<div
	class="pos-kanban-column"
	class:pos-kanban-column-dragover={dragOver}
	role="group"
	aria-label={label}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<h3 class="pos-kanban-column-title">
		{label} <span class="pos-widget-count-pill">{entities.length}</span>
	</h3>
	<div class="pos-kanban-column-cards">
		{#each entities as entity (entity.path)}
			<KanbanCard {plugin} {entity} {statuses} {columnNames} {onNavigate} {onOpenNote} {onMove} />
		{:else}
			<p class="pos-kanban-column-empty">{t("kanban.columnEmpty")}</p>
		{/each}
	</div>
</div>
