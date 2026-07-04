<script lang="ts">
	import type { Entity } from "../../../domain/entity";
	import type { Todo } from "../../../domain/todo";
	import type PersonalOSPlugin from "../../../main";
	import { t } from "../../../i18n/ja";
	import { entityProgressFraction } from "../../manage/manageData";
	import { statusLabelFor } from "../dashboardData";
	import StatusBadge from "../../components/StatusBadge.svelte";
	import DueLabel from "../../components/DueLabel.svelte";
	import ProgressIndicator from "../../components/ProgressIndicator.svelte";
	import WidgetHeader from "./WidgetHeader.svelte";

	let {
		plugin,
		todos,
		entities,
		onToggle,
		onNavigate,
		onOpenNote,
		onViewAll,
	}: {
		plugin: PersonalOSPlugin;
		todos: Todo[];
		entities: Entity[];
		onToggle: (todo: Todo) => void;
		onNavigate: (path: string, event: MouseEvent | KeyboardEvent) => void;
		onOpenNote: (path: string) => void;
		onViewAll?: () => void;
	} = $props();
</script>

<section class="pos-widget pos-widget-danger">
	<WidgetHeader icon="🔴" title={t("dashboard.widget.overdue")} count={todos.length + entities.length} {onViewAll} />
	{#if todos.length === 0 && entities.length === 0}
		<p class="pos-widget-empty pos-widget-empty-ok">✓ {t("dashboard.empty.overdue")}</p>
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
				<li class="pos-widget-item pos-widget-item-column">
					<div class="pos-widget-item-row">
						<span
							class="pos-widget-item-text"
							role="link"
							tabindex="0"
							onclick={(e) => onNavigate(entity.path, e)}
							onkeydown={(e) => e.key === "Enter" && onNavigate(entity.path, e)}
						>
							▸ {entity.title}
						</span>
						<StatusBadge value={entity.status} label={statusLabelFor(plugin, entity)} />
						<DueLabel value={entity.due} />
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
					</div>
					{#if entity.type !== "goal"}
						{@const fraction = entityProgressFraction(plugin.store, entity)}
						<ProgressIndicator progress={entity.progress ?? 0} done={fraction.done} total={fraction.total} />
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
