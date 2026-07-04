<script lang="ts">
	import type { Todo } from "../../../domain/todo";
	import { t } from "../../../i18n/ja";

	let {
		todos,
		onToggle,
		onNavigate,
		onOpenNote,
	}: {
		todos: Todo[];
		onToggle: (todo: Todo) => void;
		onNavigate: (path: string, event: MouseEvent | KeyboardEvent) => void;
		onOpenNote: (path: string) => void;
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
						onclick={(e) => onNavigate(todo.parentPath, e)}
						onkeydown={(e) => e.key === "Enter" && onNavigate(todo.parentPath, e)}
					>
						{todo.text}
					</span>
					{#if todo.dueDate}<span class="pos-widget-due">📅 {todo.dueDate}</span>{/if}
					<button
						class="pos-widget-open-note"
						onclick={(e) => {
							e.stopPropagation();
							onOpenNote(todo.parentPath);
						}}
						aria-label={t("dashboard.openNote")}
					>
						↗
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
