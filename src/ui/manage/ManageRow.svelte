<script lang="ts">
	import type { Entity, Priority } from "../../domain/entity";
	import { PRIORITIES, validStatusesOf } from "../../domain/entity";
	import type { Todo } from "../../domain/todo";
	import type PersonalOSPlugin from "../../main";
	import { manageDeleteConfirmMessage, t } from "../../i18n/ja";
	import { VIEW_TYPE_PREVIEW } from "../preview/PreviewView";
	import { ConfirmModal } from "../modals/ConfirmModal";
	import { PromoteTicketModal, PromoteTodoModal } from "../modals/PromoteModal";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import DateCell from "../components/DateCell.svelte";
	import ParentCell from "../components/ParentCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import RowMenu from "../components/RowMenu.svelte";
	import type { ManageRowData, ManageTab } from "./manageData";

	let {
		row,
		tab,
		plugin,
		onOpen,
		onNavigate,
	}: {
		row: ManageRowData;
		tab: ManageTab;
		plugin: PersonalOSPlugin;
		onOpen: (path: string) => void;
		/** 指定時、行の空白部分クリックでentity詳細へ遷移する(design-drilldown-nav.md §3.1.1)。todo行には渡さない */
		onNavigate?: (path: string) => void;
	} = $props();

	function statusOptions(entity: Entity): { value: string; label: string }[] {
		const valid = validStatusesOf(entity.type) ?? [entity.status];
		const names: Record<string, string> | undefined =
			entity.type === "project"
				? plugin.settings.kanbanColumnNames.project
				: entity.type === "ticket"
					? plugin.settings.kanbanColumnNames.ticket
					: undefined;
		return valid.map((s) => ({ value: s, label: names?.[s] ?? s }));
	}

	function priorityOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];
	}

	function parentOptions(): { value: string; label: string }[] {
		const parentType = tab === "project" ? "goal" : "project";
		return plugin.store.listByType(parentType).map((e) => ({ value: e.path, label: e.title }));
	}

	// ---- Entity書き込み経路(design-ui-first.md §4.2): statusのみEntityService、他はEntityFieldService ----
	function commitStatus(entity: Entity, next: string): Promise<void> {
		return plugin.entityService.changeStatus(entity.path, next);
	}
	function commitPriority(entity: Entity, next: string): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "priority", next);
	}
	function commitDue(entity: Entity, next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "due", next);
	}
	function commitParent(entity: Entity, next: string | undefined): Promise<void> {
		const key = tab === "project" ? "goal" : "project";
		return plugin.entityFieldService.updateField(entity.path, key, next);
	}
	function commitTitle(entity: Entity, next: string): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "title", next);
	}

	// ---- Todo書き込み経路: TodoService.updateInline ----
	function commitTodoText(todo: Todo, next: string): Promise<void> {
		return plugin.todoService.updateInline(todo, { text: next });
	}
	function commitTodoDue(todo: Todo, next: string | undefined): Promise<void> {
		return plugin.todoService.updateInline(todo, { dueDate: next ?? null });
	}
	function commitTodoPriority(todo: Todo, next: string): Promise<void> {
		return plugin.todoService.updateInline(todo, { priority: (next || null) as Priority | null });
	}

	// ---- RowMenu操作 ----
	function showPreview(path: string): void {
		const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_PREVIEW);
		if (leaves.length > 0) plugin.app.workspace.revealLeaf(leaves[0]);
		onOpen(path);
	}

	function promoteEntity(entity: Entity): void {
		new PromoteTicketModal(plugin.app, {
			promoteService: plugin.promoteService,
			ticketPath: entity.path,
			ticketTitle: entity.title,
		}).open();
	}

	function archiveEntity(entity: Entity): void {
		void plugin.entityService.archive(entity.path);
	}

	function deleteEntity(entity: Entity): void {
		new ConfirmModal(plugin.app, {
			message: manageDeleteConfirmMessage(entity.title),
			onConfirm: () => plugin.entityService.delete(entity.path),
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

	function deleteTodo(todo: Todo): void {
		new ConfirmModal(plugin.app, {
			message: manageDeleteConfirmMessage(todo.text),
			onConfirm: () => plugin.todoService.remove(todo),
		}).open();
	}
</script>

{#if row.kind === "entity" && row.entity}
	{@const entity = row.entity}
	<tr class="pos-manage-row" class:pos-manage-row-navigable={!!onNavigate} onclick={() => onNavigate?.(entity.path)}>
		<td onclick={(e) => e.stopPropagation()}><TitleCell value={entity.title} onCommit={(next) => commitTitle(entity, next)} /></td>
		<td onclick={(e) => e.stopPropagation()}>
			<StatusCell value={entity.status} options={statusOptions(entity)} onCommit={(next) => commitStatus(entity, next)} />
		</td>
		<td onclick={(e) => e.stopPropagation()}>
			<ParentCell
				value={tab === "project" ? entity.goal : entity.project}
				options={parentOptions()}
				onCommit={(next) => commitParent(entity, next)}
			/>
		</td>
		<td onclick={(e) => e.stopPropagation()}>
			<PriorityCell value={entity.priority ?? ""} options={priorityOptions()} onCommit={(next) => commitPriority(entity, next)} />
		</td>
		<td onclick={(e) => e.stopPropagation()}>
			{#if entity.type !== "goal"}
				<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
					<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
				</div>
				<span class="pos-progress-label">{entity.progress ?? 0}%</span>
			{/if}
		</td>
		<td onclick={(e) => e.stopPropagation()}><DateCell value={entity.due} onCommit={(next) => commitDue(entity, next)} /></td>
		<td onclick={(e) => e.stopPropagation()}>
			{#each entity.labels as label (label)}
				<span class="pos-manage-chip pos-manage-chip-static">{label}</span>
			{/each}
		</td>
		<td onclick={(e) => e.stopPropagation()}>
			<RowMenu
				onOpenNote={() => onOpen(entity.path)}
				onShowPreview={() => showPreview(entity.path)}
				onPromote={tab === "ticket" ? () => promoteEntity(entity) : undefined}
				onArchive={() => archiveEntity(entity)}
				onDelete={() => deleteEntity(entity)}
			/>
		</td>
	</tr>
{:else if row.kind === "todo" && row.todo}
	{@const todo = row.todo}
	<tr class="pos-manage-row">
		<td><input type="checkbox" checked={todo.done} onchange={() => void plugin.todoService.toggle(todo)} /></td>
		<td><TitleCell value={todo.text} onCommit={(next) => commitTodoText(todo, next)} /></td>
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
		<td>
			<PriorityCell value={todo.priority ?? ""} options={priorityOptions()} onCommit={(next) => commitTodoPriority(todo, next)} />
		</td>
		<td><DateCell value={todo.dueDate} onCommit={(next) => commitTodoDue(todo, next)} /></td>
		<td>
			<RowMenu
				onOpenNote={() => onOpen(todo.parentPath)}
				onShowPreview={() => showPreview(todo.parentPath)}
				onPromote={() => promoteTodo(todo)}
				onDelete={() => deleteTodo(todo)}
			/>
		</td>
	</tr>
{/if}
