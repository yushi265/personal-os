<script lang="ts">
	import type { Entity } from "../../../domain/entity";
	import type { Todo } from "../../../domain/todo";
	import { t } from "../../../i18n/ja";

	let {
		todos,
		entities,
		onToggle,
		onNavigate,
		onOpenNote,
	}: {
		todos: Todo[];
		entities: Entity[];
		onToggle: (todo: Todo) => void;
		onNavigate: (path: string, event: MouseEvent | KeyboardEvent) => void;
		onOpenNote: (path: string) => void;
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
						onclick={(e) => onNavigate(todo.parentPath, e)}
						onkeydown={(e) => e.key === "Enter" && onNavigate(todo.parentPath, e)}
					>
						{todo.text}
					</span>
					<span class="pos-widget-due">📅 {todo.dueDate}</span>
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
			{#each entities as entity (entity.path)}
				<li class="pos-widget-item">
					<span
						class="pos-widget-item-text"
						role="link"
						tabindex="0"
						onclick={(e) => onNavigate(entity.path, e)}
						onkeydown={(e) => e.key === "Enter" && onNavigate(entity.path, e)}
					>
						▸ {entity.title}
					</span>
					<span class="pos-widget-due">due: {entity.due}</span>
					{#if entity.type !== "goal"}
						<button
							class="pos-widget-open-note"
							onclick={(e) => {
								e.stopPropagation();
								onOpenNote(entity.path);
							}}
							aria-label={t("dashboard.openNote")}
						>
							↗
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
