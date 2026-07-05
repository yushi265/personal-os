<script lang="ts">
	import { Notice, Platform } from "obsidian";
	import type { Priority } from "../../domain/entity";
	import { PRIORITIES } from "../../domain/entity";
	import type { Todo } from "../../domain/todo";
	import { rebuildTodoLine } from "../../domain/todo";
	import type { MoveTodoTarget } from "../../domain/todo";
	import type PersonalOSPlugin from "../../main";
	import { t, todoDeletedUndoNotice } from "../../i18n/ja";
	import { showUndoNotice } from "../undoNotice";
	import { PromoteTodoModal } from "../modals/PromoteModal";
	import { DueDateModal } from "../modals/DueDateModal";
	import { buildTodoMenu } from "./todoMenuBuilder";
	import { longpress } from "../longpress";
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
	// 戻り値(TodoWriteResult)はブラウザUIサーバー(ApiRouter)のline-mismatch判定用。UI側は従来通り結果を見ない。
	async function commitTodoText(todo: Todo, next: string): Promise<void> {
		await plugin.todoService.updateInline(todo, { text: next });
	}
	async function commitTodoDue(todo: Todo, next: string | undefined): Promise<void> {
		await plugin.todoService.updateInline(todo, { dueDate: next ?? null });
	}
	async function commitTodoPriority(todo: Todo, next: string): Promise<void> {
		await plugin.todoService.updateInline(todo, { priority: (next || null) as Priority | null });
	}

	function toggleTodo(todo: Todo): void {
		void plugin.todoService.toggle(todo);
	}

	// D&Dによる手動並び替え(design-reorder-and-notes.md A-1/A-4): Todoは行の物理順序そのものが並び順のため、
	// 専用プロパティ不要。TodoService.reorder経由でprocessBodyによる行の削除+再挿入を行う。
	function todoKey(todo: Todo): string {
		return `${todo.filePath}#${todo.line}`;
	}

	function handleDragStart(event: DragEvent, todo: Todo): void {
		event.dataTransfer?.setData("text/plain", todoKey(todo));
	}

	function handleDrop(event: DragEvent, target: Todo): void {
		event.preventDefault();
		const draggedKey = event.dataTransfer?.getData("text/plain");
		if (!draggedKey || draggedKey === todoKey(target)) return;
		const dragged = visibleTodos.find((t) => todoKey(t) === draggedKey);
		if (!dragged || dragged.filePath !== target.filePath) return; // 別ノートのTodoへの移動はサポートしない
		void moveTodo(dragged, { kind: "beforeLine", lineContent: rebuildTodoLine(target) });
	}

	async function moveTodo(todo: Todo, target: MoveTodoTarget): Promise<void> {
		await plugin.todoService.reorder(todo, target);
	}


	async function deleteTodo(todo: Todo): Promise<void> {
		const savedLine = rebuildTodoLine(todo, { stripIndent: true });
		await plugin.todoService.remove(todo);
		showUndoNotice(todoDeletedUndoNotice(todo.text), () => plugin.todoService.restoreLine(todo.parentPath, savedLine));
	}

	function promoteTodo(todo: Todo): void {
		new PromoteTodoModal(plugin.app, {
			promoteService: plugin.promoteService,
			store: plugin.store,
			todo,
			todoFeatures: plugin.capability.todoFeatures,
		}).open();
	}

	// モバイル(design: モバイル長押しメニュー化): 長押しメニューの「テキストを編集」からTitleCellの編集開始を
	// 起動する外部トリガー。todoごとに別要素のTitleCellがあるため、keyごとにトークンを持つ(ManageRow.svelteと同じ方式)
	let editTodoTokens = $state<Record<string, number>>({});
	function requestEditTodoText(todo: Todo): void {
		const key = todoKey(todo);
		editTodoTokens[key] = (editTodoTokens[key] ?? 0) + 1;
	}

	// 長押しメニュー「優先度: ...」: 現在値を候補から除く(ManageRow.svelte changePriorityOptionsと同じ発想)
	function changeTodoPriorityOptions(todo: Todo): { value: string; label: string }[] {
		const current = todo.priority ?? "";
		return priorityOptions().filter((o) => o.value !== current);
	}

	// Obsidianのcontext menuには日付入力欄を置けないため、専用のDueDateModalを開く
	function openDueDateModal(todo: Todo): void {
		new DueDateModal(plugin.app, {
			initialValue: todo.dueDate,
			onSubmit: (next) => commitTodoDue(todo, next),
		}).open();
	}

	function openTodoMenu(todo: Todo, index: number, x: number, y: number): void {
		buildTodoMenu({
			priorityOptions: changeTodoPriorityOptions(todo),
			onChangePriority: (next) => void commitTodoPriority(todo, next),
			onSetDueDate: () => openDueDateModal(todo),
			onEditText: () => requestEditTodoText(todo),
			moveUpDisabled: index === 0,
			onMoveUp: () => void moveTodo(todo, { kind: "up" }),
			moveDownDisabled: index === visibleTodos.length - 1,
			onMoveDown: () => void moveTodo(todo, { kind: "down" }),
			onPromote: () => promoteTodo(todo),
			onDelete: () => void deleteTodo(todo),
		}).showAtPosition({ x, y });
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
		{#each visibleTodos as todo, i (todo.filePath + "#" + todo.line)}
			<li
				class="pos-widget-item pos-preview-todo-row"
				ondragover={(e) => e.preventDefault()}
				ondrop={(e) => handleDrop(e, todo)}
				use:longpress={{ enabled: Platform.isMobile, onLongPress: (x, y) => openTodoMenu(todo, i, x, y) }}
			>
				<!-- 上段(モバイル): チェックボックス+本文。display:contentsによりデスクトップでは従来通りliの直下フラットフレックス項目として扱われる -->
				<div class="pos-todo-row-top">
					<!-- svelte-ignore a11y_no_static_element_interactions -- ドラッグハンドル(design-reorder-and-notes.md A-4)。上下移動ボタンを別途用意しているため代替操作は確保済み -->
					<span
						class="pos-preview-todo-drag"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, todo)}
						title={t("preview.todo.dragHandle")}
						aria-label={t("preview.todo.dragHandle")}
					>
						⠿
					</span>
					<input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo)} />
					<span class="pos-preview-todo-text">
						<TitleCell
							value={todo.text}
							onCommit={(next) => commitTodoText(todo, next)}
							editRequestToken={editTodoTokens[todoKey(todo)] ?? 0}
						/>
					</span>
				</div>
				<!-- 下段(モバイル): メタ情報(親バッジ/優先度/期限) -->
				<div class="pos-todo-row-meta">
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
					<span class="pos-todolist-priority-cell" class:pos-todolist-cell-empty={!todo.priority}>
						<PriorityCell
							value={todo.priority ?? ""}
							options={priorityOptions()}
							onCommit={(next) => commitTodoPriority(todo, next)}
						/>
					</span>
					<span class="pos-todolist-due-cell" class:pos-todolist-cell-empty={!todo.dueDate}>
						<DateCell value={todo.dueDate} onCommit={(next) => commitTodoDue(todo, next)} relative />
					</span>
				</div>
				<!-- 下段(モバイル): 操作ボタン群 -->
				<div class="pos-todo-row-actions">
					<button
						class="pos-preview-todo-action"
						disabled={i === 0}
						onclick={() => moveTodo(todo, { kind: "up" })}
						aria-label={t("preview.todo.moveUp")}
					>
						▲
					</button>
					<button
						class="pos-preview-todo-action"
						disabled={i === visibleTodos.length - 1}
						onclick={() => moveTodo(todo, { kind: "down" })}
						aria-label={t("preview.todo.moveDown")}
					>
						▼
					</button>
					<button class="pos-preview-todo-action" onclick={() => promoteTodo(todo)}>{t("preview.todo.promote")}</button>
					<button class="pos-preview-todo-action pos-btn-danger-ghost" onclick={() => deleteTodo(todo)}>
						{t("preview.todo.delete")}
					</button>
				</div>
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
