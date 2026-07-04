<script lang="ts">
	import type { ManageRowData } from "./manageData";

	let {
		row,
		onOpen,
	}: {
		row: ManageRowData;
		onOpen: (path: string) => void;
	} = $props();
</script>

{#if row.kind === "entity" && row.entity}
	{@const entity = row.entity}
	<tr class="pos-manage-row">
		<td>
			<span
				class="pos-manage-title-link"
				role="link"
				tabindex="0"
				onclick={() => onOpen(entity.path)}
				onkeydown={(e) => e.key === "Enter" && onOpen(entity.path)}
			>
				{entity.title}
			</span>
		</td>
		<td>{entity.status}</td>
		<td>{row.parentTitle ?? ""}</td>
		<td>{entity.priority ?? ""}</td>
		<td>
			{#if entity.type !== "goal"}
				<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
					<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
				</div>
				<span class="pos-progress-label">{entity.progress ?? 0}%</span>
			{/if}
		</td>
		<td>{entity.due ?? ""}</td>
		<td>
			{#each entity.labels as label (label)}
				<span class="pos-manage-chip pos-manage-chip-static">{label}</span>
			{/each}
		</td>
	</tr>
{:else if row.kind === "todo" && row.todo}
	{@const todo = row.todo}
	<tr class="pos-manage-row">
		<td><input type="checkbox" checked={todo.done} disabled /></td>
		<td>{todo.text}</td>
		<td>
			<span
				class="pos-manage-title-link"
				role="link"
				tabindex="0"
				onclick={() => onOpen(todo.parentPath)}
				onkeydown={(e) => e.key === "Enter" && onOpen(todo.parentPath)}
			>
				{row.parentTitle}
				<span class="pos-manage-parent-badge">{todo.parentType}</span>
			</span>
		</td>
		<td>{todo.priority ?? ""}</td>
		<td>{todo.dueDate ?? ""}</td>
	</tr>
{/if}
