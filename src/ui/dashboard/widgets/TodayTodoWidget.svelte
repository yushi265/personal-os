<script lang="ts">
	import type { Todo } from "../../../domain/todo";
	import { t } from "../../../i18n/ja";

	let {
		todos,
		onToggle,
		onOpen,
	}: {
		todos: Todo[];
		onToggle: (todo: Todo) => void;
		onOpen: (path: string) => void;
	} = $props();
</script>

<section class="pos-widget">
	<h3 class="pos-widget-title">{t("dashboard.widget.todayTodo")}</h3>
	{#if todos.length === 0}
		<p class="pos-widget-empty">{t("dashboard.empty.todayTodo")}</p>
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
					{#if todo.dueDate}<span class="pos-widget-due">📅 {todo.dueDate}</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
