<script lang="ts">
	import type { Entity } from "../../../domain/entity";
	import type { Todo } from "../../../domain/todo";
	import { t } from "../../../i18n/ja";

	let {
		todos,
		entities,
		onToggle,
		onOpen,
	}: {
		todos: Todo[];
		entities: Entity[];
		onToggle: (todo: Todo) => void;
		onOpen: (path: string) => void;
	} = $props();
</script>

<section class="pos-widget pos-widget-danger">
	<h3 class="pos-widget-title">{t("dashboard.widget.overdue")} 🔴</h3>
	{#if todos.length === 0 && entities.length === 0}
		<p class="pos-widget-empty">{t("dashboard.empty.overdue")}</p>
	{:else}
		<ul class="pos-widget-list">
			{#each todos as todo (todo.filePath + "#" + todo.line)}
				<li class="pos-widget-item">
					<input type="checkbox" checked={todo.done} onchange={() => onToggle(todo)} />
					<span
						class="pos-widget-item-text"
						role="link"
						tabindex="0"
						onclick={() => onOpen(todo.parentPath)}
						onkeydown={(e) => e.key === "Enter" && onOpen(todo.parentPath)}
					>
						{todo.text}
					</span>
					<span class="pos-widget-due">📅 {todo.dueDate}</span>
				</li>
			{/each}
			{#each entities as entity (entity.path)}
				<li class="pos-widget-item">
					<span
						class="pos-widget-item-text"
						role="link"
						tabindex="0"
						onclick={() => onOpen(entity.path)}
						onkeydown={(e) => e.key === "Enter" && onOpen(entity.path)}
					>
						▸ {entity.title}
					</span>
					<span class="pos-widget-due">due: {entity.due}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
