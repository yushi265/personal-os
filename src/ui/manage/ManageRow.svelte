<script lang="ts">
	import type { Entity } from "../../domain/entity";
	import { PRIORITIES, validStatusesOf } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { manageDeleteConfirmMessage, t } from "../../i18n/ja";
	import { VIEW_TYPE_PREVIEW } from "../preview/PreviewView";
	import { ConfirmModal } from "../modals/ConfirmModal";
	import { PromoteTicketModal } from "../modals/PromoteModal";
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
		/** 指定時、行の空白部分クリックでentity詳細へ遷移する(design-drilldown-nav.md §3.1.1) */
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
</script>

{#if row.entity}
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
{/if}
