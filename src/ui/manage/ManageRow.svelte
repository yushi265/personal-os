<script lang="ts">
	import type { Entity } from "../../domain/entity";
	import { PRIORITIES, validStatusesOf } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { archivedUndoNotice, deletedUndoNotice, t } from "../../i18n/ja";
	import { VIEW_TYPE_PREVIEW } from "../preview/PreviewView";
	import { showUndoNotice } from "../undoNotice";
	import { PromoteTicketModal } from "../modals/PromoteModal";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import DateCell from "../components/DateCell.svelte";
	import ParentCell from "../components/ParentCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import RowMenu from "../components/RowMenu.svelte";
	import RowBadges from "../components/RowBadges.svelte";
	import ProgressIndicator from "../components/ProgressIndicator.svelte";
	import { entityProgressFraction, type ManageRowData, type ManageTab } from "./manageData";

	let {
		row,
		tab,
		plugin,
		onOpen,
		onNavigate,
		showParentColumn = true,
		focused = false,
	}: {
		row: ManageRowData;
		tab: ManageTab;
		plugin: PersonalOSPlugin;
		onOpen: (path: string) => void;
		/** 指定時、行の空白部分クリックでentity詳細へ遷移する(design-drilldown-nav.md §3.1.1) */
		onNavigate?: (path: string) => void;
		/** ManageTableのGoal/Project列(ParentCell)を表示するかどうか(呼び出し元で既にグルーピング済みの場合はfalse) */
		showParentColumn?: boolean;
		/** ManageTableのキーボード操作(↑/↓)によるフォーカス中の行かどうか(Phase U2) */
		focused?: boolean;
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

	// タイトルの編集開始をRowMenu「名前を変更」からも起動できるようにする外部トリガー(TitleCell参照)
	let editTitleToken = $state(0);
	function requestRenameTitle(): void {
		editTitleToken++;
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

	async function archiveEntity(entity: Entity): Promise<void> {
		const originalPath = entity.path;
		const originalStatus = entity.status;
		const newPath = await plugin.entityService.archive(originalPath);
		showUndoNotice(archivedUndoNotice(entity.title), () =>
			plugin.entityService.restoreFromArchive(newPath, originalPath, originalStatus)
		);
	}

	async function deleteEntity(entity: Entity): Promise<void> {
		const savedContent = await plugin.repo.readBody(entity.path);
		await plugin.entityService.delete(entity.path);
		showUndoNotice(deletedUndoNotice(entity.title), async () => {
			await plugin.repo.restoreFile(entity.path, savedContent);
		});
	}

	function badgeCounts(entity: Entity): { blockers: number; memos: number; todos: number } {
		return {
			blockers: entity.blockers.length,
			memos: plugin.store.getMemoCount(entity.path),
			todos: plugin.store.getTodos(entity.path).filter((todo) => !todo.done).length,
		};
	}
</script>

{#if row.entity}
	{@const entity = row.entity}
	{@const badges = badgeCounts(entity)}
	{@const fraction = entityProgressFraction(plugin.store, entity)}
	<tr
		class="pos-manage-row"
		class:pos-manage-row-navigable={!!onNavigate}
		class:pos-manage-row-focused={focused}
		onclick={() => onNavigate?.(entity.path)}
	>
		<td class="pos-manage-cell-title" onclick={(e) => e.stopPropagation()}>
			<TitleCell
				value={entity.title}
				onCommit={(next) => commitTitle(entity, next)}
				onNavigate={onNavigate ? () => onNavigate?.(entity.path) : undefined}
				editRequestToken={editTitleToken}
				app={plugin.app}
				hoverSourcePath={entity.path}
			/>
			<RowBadges blockerCount={badges.blockers} memoCount={badges.memos} todoCount={badges.todos} />
		</td>
		<td class="pos-manage-cell-status" onclick={(e) => e.stopPropagation()}>
			<StatusCell value={entity.status} options={statusOptions(entity)} onCommit={(next) => commitStatus(entity, next)} />
		</td>
		{#if showParentColumn}
			<td class="pos-manage-cell-parent" onclick={(e) => e.stopPropagation()}>
				<ParentCell
					value={tab === "project" ? entity.goal : entity.project}
					options={parentOptions()}
					onCommit={(next) => commitParent(entity, next)}
				/>
			</td>
		{/if}
		<td class="pos-manage-cell-priority" onclick={(e) => e.stopPropagation()}>
			<PriorityCell value={entity.priority ?? ""} options={priorityOptions()} onCommit={(next) => commitPriority(entity, next)} />
		</td>
		<td class="pos-manage-cell-progress" onclick={(e) => e.stopPropagation()}>
			{#if entity.type !== "goal"}
				<ProgressIndicator progress={entity.progress ?? 0} done={fraction.done} total={fraction.total} />
			{/if}
		</td>
		<td class="pos-manage-cell-due" onclick={(e) => e.stopPropagation()}>
			<DateCell value={entity.due} onCommit={(next) => commitDue(entity, next)} relative />
		</td>
		<td class="pos-manage-cell-labels" onclick={(e) => e.stopPropagation()}>
			{#each entity.labels as label (label)}
				<span class="pos-manage-chip pos-manage-chip-static">{label}</span>
			{/each}
		</td>
		<td class="pos-manage-cell-actions" onclick={(e) => e.stopPropagation()}>
			<RowMenu
				onOpenNote={() => onOpen(entity.path)}
				onShowPreview={() => showPreview(entity.path)}
				onRename={onNavigate ? requestRenameTitle : undefined}
				onPromote={tab === "ticket" ? () => promoteEntity(entity) : undefined}
				onArchive={() => archiveEntity(entity)}
				onDelete={() => deleteEntity(entity)}
			/>
		</td>
		{#if onNavigate}
			<td class="pos-manage-nav-cell pos-manage-cell-nav" onclick={(e) => e.stopPropagation()}>
				<button
					type="button"
					class="pos-manage-nav-chevron"
					aria-label={t("manage.nav.openDetail")}
					onclick={() => onNavigate?.(entity.path)}
				>
					›
				</button>
			</td>
		{:else}
			<td></td>
		{/if}
	</tr>
{/if}
