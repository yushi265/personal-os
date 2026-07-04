<script lang="ts">
	import type { Entity } from "../../domain/entity";
	import KanbanCard from "./KanbanCard.svelte";

	let {
		status,
		label,
		entities,
		statuses,
		columnNames,
		onOpen,
		onMove,
		onDrop,
	}: {
		status: string;
		label: string;
		entities: Entity[];
		statuses: readonly string[];
		columnNames: Record<string, string>;
		onOpen: (path: string) => void;
		onMove: (path: string, status: string) => void;
		onDrop: (status: string, event: DragEvent) => void;
	} = $props();

	function handleDragOver(e: DragEvent): void {
		e.preventDefault();
	}

	function handleDrop(e: DragEvent): void {
		onDrop(status, e);
	}
</script>

<div class="pos-kanban-column" role="group" aria-label={label} ondragover={handleDragOver} ondrop={handleDrop}>
	<h3 class="pos-kanban-column-title">
		{label} <span class="pos-kanban-column-count">{entities.length}</span>
	</h3>
	<div class="pos-kanban-column-cards">
		{#each entities as entity (entity.path)}
			<KanbanCard {entity} {statuses} {columnNames} {onOpen} {onMove} />
		{/each}
	</div>
</div>
