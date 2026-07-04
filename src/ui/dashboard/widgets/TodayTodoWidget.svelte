<script lang="ts">
	import type { Todo } from "../../../domain/todo";
	import { t } from "../../../i18n/ja";
	import DueLabel from "../../components/DueLabel.svelte";
	import WidgetHeader from "./WidgetHeader.svelte";

	let {
		todos,
		onToggle,
		onNavigate,
		onViewAll,
	}: {
		todos: Todo[];
		onToggle: (todo: Todo) => void;
		onNavigate: (path: string, event: MouseEvent | KeyboardEvent) => void;
		onViewAll?: () => void;
	} = $props();
</script>

<section class="pos-widget">
	<WidgetHeader icon="📅" title={t("dashboard.widget.todayTodo")} count={todos.length} {onViewAll} />
	{#if todos.length === 0}
		<p class="pos-widget-empty pos-widget-empty-ok">✓ {t("dashboard.empty.todayTodo")}</p>
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
					<DueLabel value={todo.dueDate} />
				</li>
			{/each}
		</ul>
	{/if}
</section>
