<script lang="ts">
	import { Notice } from "obsidian";
	import type { Priority } from "../../domain/entity";
	import { PRIORITIES } from "../../domain/entity";
	import type { Todo } from "../../domain/todo";
	import type PersonalOSPlugin from "../../main";
	import { manageDeleteConfirmMessage, t } from "../../i18n/ja";
	import { ConfirmModal } from "../modals/ConfirmModal";
	import { PromoteTodoModal } from "../modals/PromoteModal";
	import TitleCell from "./TitleCell.svelte";
	import PriorityCell from "./PriorityCell.svelte";
	import DateCell from "./DateCell.svelte";

	/**
	 * Todo一覧の共通表示・操作部品(design-drilldown-nav.md §3.4)。
	 * Preview.svelte/ProjectDetailScreen.svelte/TicketDetailScreen.svelteの3箇所から使う。
	 * capability(todoFeatures)判定は持たない。呼び出し元の{#if}で制御する。
	 */
	let {
		plugin,
		todos,
		showDone,
		showParentBadge = false,
		addTarget,
		onParentClick,
	}: {
		plugin: PersonalOSPlugin;
		todos: Todo[];
		showDone: boolean;
		showParentBadge?: boolean;
		addTarget?: string;
		onParentClick?: (path: string) => void;
	} = $props();

	const visibleTodos = $derived(showDone ? todos : todos.filter((todo) => !todo.done));

	function priorityOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];
	}

	function parentTitle(todo: Todo): string {
		return plugin.store.get(todo.parentPath)?.title ?? todo.parentPath;
	}

	// ---- 書き込み経路(design-ui-first.md §4.5): TodoService.updateInline/toggle/remove ----
	function commitTodoText(todo: Todo, next: string): Promise<void> {
		return plugin.todoService.updateInline(todo, { text: next });
	}
	function commitTodoDue(todo: Todo, next: string | undefined): Promise<void> {
		return plugin.todoService.updateInline(todo, { dueDate: next ?? null });
	}
	function commitTodoPriority(todo: Todo, next: string): Promise<void> {
		return plugin.todoService.updateInline(todo, { priority: (next || null) as Priority | null });
	}

	function toggleTodo(todo: Todo): void {
		void plugin.todoService.toggle(todo);
	}

	function deleteTodo(todo: Todo): void {
		new ConfirmModal(plugin.app, {
			message: manageDeleteConfirmMessage(todo.text),
			onConfirm: () => plugin.todoService.remove(todo),
		}).open();
	}

	function promoteTodo(todo: Todo): void {
		new PromoteTodoModal(plugin.app, {
			promoteService: plugin.promoteService,
			store: plugin.store,
			todo,
			todoFeatures: plugin.capability.todoFeatures,
		}).open();
	}

	// フッタ「+ Todoを追加」フォーム(design-ui-first.md §4.4、失敗時は入力内容を保持する)。addTarget未指定時は表示しない
	let newTodoText = $state("");
	let newTodoDue = $state("");
	let newTodoPriority = $state("");

	async function submitAddTodo(): Promise<void> {
		if (!addTarget) return;
		const text = newTodoText.trim();
		if (!text) {
			new Notice(t("preview.todoAdd.textRequired"));
			return;
		}
		try {
			await plugin.todoService.addToSection(addTarget, {
				text,
				dueDate: newTodoDue || undefined,
				priority: (newTodoPriority || undefined) as Priority | undefined,
			});
			newTodoText = "";
			newTodoDue = "";
			newTodoPriority = "";
		} catch {
			new Notice(t("manage.todoAddFailed"));
		}
	}
</script>

{#if visibleTodos.length === 0}
	<p class="pos-widget-empty">{t("preview.empty.todos")}</p>
{:else}
	<ul class="pos-widget-list">
		{#each visibleTodos as todo (todo.filePath + "#" + todo.line)}
			<li class="pos-widget-item pos-preview-todo-row">
				<input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo)} />
				<span class="pos-preview-todo-text">
					<TitleCell value={todo.text} onCommit={(next) => commitTodoText(todo, next)} />
				</span>
				{#if showParentBadge}
					{#if todo.parentType === "ticket"}
						<span
							class="pos-todolist-parent-badge pos-todolist-parent-clickable"
							role="link"
							tabindex="0"
							onclick={() => onParentClick?.(todo.parentPath)}
							onkeydown={(e) => e.key === "Enter" && onParentClick?.(todo.parentPath)}
						>
							{parentTitle(todo)}
						</span>
					{:else}
						<span class="pos-todolist-parent-badge">{parentTitle(todo)}</span>
					{/if}
				{/if}
				<PriorityCell
					value={todo.priority ?? ""}
					options={priorityOptions()}
					onCommit={(next) => commitTodoPriority(todo, next)}
				/>
				<DateCell value={todo.dueDate} onCommit={(next) => commitTodoDue(todo, next)} />
				<button class="pos-preview-todo-action" onclick={() => promoteTodo(todo)}>{t("preview.todo.promote")}</button>
				<button class="pos-preview-todo-action mod-warning" onclick={() => deleteTodo(todo)}>
					{t("preview.todo.delete")}
				</button>
			</li>
		{/each}
	</ul>
{/if}

{#if addTarget}
	<form
		class="pos-preview-todo-add"
		onsubmit={(e) => {
			e.preventDefault();
			void submitAddTodo();
		}}
	>
		<input
			type="text"
			class="pos-preview-todo-add-text"
			placeholder={t("preview.todoAdd.textPlaceholder")}
			bind:value={newTodoText}
		/>
		<input type="date" class="pos-preview-todo-add-due" aria-label={t("preview.todoAdd.due")} bind:value={newTodoDue} />
		<select class="pos-preview-todo-add-priority" aria-label={t("preview.todoAdd.priority")} bind:value={newTodoPriority}>
			<option value="">{t("manage.field.unset")}</option>
			{#each PRIORITIES as p (p)}
				<option value={p}>{p}</option>
			{/each}
		</select>
		<button type="submit" class="pos-manage-new-btn">{t("preview.todoAdd.submit")}</button>
	</form>
{/if}
