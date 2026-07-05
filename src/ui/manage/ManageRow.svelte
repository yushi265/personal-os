<script lang="ts">
	import { Notice, Platform } from "obsidian";
	import type { Entity } from "../../domain/entity";
	import { PRIORITIES, validStatusesOf } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { archivedUndoNotice, deletedUndoNotice, t } from "../../i18n/ja";
	import { VIEW_TYPE_PREVIEW } from "../preview/PreviewView";
	import { showUndoNotice } from "../undoNotice";
	import { PromoteTicketModal } from "../modals/PromoteModal";
	import { ParentPickerModal } from "../modals/ParentPickerModal";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import DateCell from "../components/DateCell.svelte";
	import ParentCell from "../components/ParentCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import RowMenu from "../components/RowMenu.svelte";
	import RowBadges from "../components/RowBadges.svelte";
	import ProgressIndicator from "../components/ProgressIndicator.svelte";
	import { buildRowMenu, type RowMenuActions } from "../components/rowMenuBuilder";
	import { longpress } from "../longpress";
	import { entityProgressFraction, type ManageRowData, type ManageSort, type ManageTab } from "./manageData";

	let {
		row,
		tab,
		plugin,
		sort,
		onOpen,
		onNavigate,
		showParentColumn = true,
		focused = false,
		dragInsertBefore = false,
		dragInsertAfter = false,
		onDragStartRow,
		onDragOverRow,
		onDragLeaveRow,
		onDropRow,
		onMoveUp,
		onMoveDown,
	}: {
		row: ManageRowData;
		tab: ManageTab;
		plugin: PersonalOSPlugin;
		/** manualソート時のみドラッグハンドルを有効化するための現在のソート状態(design-reorder-and-notes.md A-4) */
		sort: ManageSort;
		onOpen: (path: string) => void;
		/** 指定時、行の空白部分クリックでentity詳細へ遷移する(design-drilldown-nav.md §3.1.1) */
		onNavigate?: (path: string) => void;
		/** ManageTableのGoal/Project列(ParentCell)を表示するかどうか(呼び出し元で既にグルーピング済みの場合はfalse) */
		showParentColumn?: boolean;
		/** ManageTableのキーボード操作(↑/↓)によるフォーカス中の行かどうか(Phase U2) */
		focused?: boolean;
		/** ドラッグオーバー中、この行の上端/下端どちらに挿入されるかの表示(design-reorder-and-notes.md A-4) */
		dragInsertBefore?: boolean;
		dragInsertAfter?: boolean;
		onDragStartRow?: (event: DragEvent) => void;
		onDragOverRow?: (event: DragEvent) => void;
		onDragLeaveRow?: (event: DragEvent) => void;
		onDropRow?: (event: DragEvent) => void;
		/** モバイル代替(design-reorder-and-notes.md A-5): RowMenuの「上へ移動」「下へ移動」 */
		onMoveUp?: () => void;
		onMoveDown?: () => void;
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

	// RowMenu「▸ ステータス」: 現在値(選んでも無意味)とarchived(専用のArchive項目がある)を候補から除く
	function changeStatusOptions(entity: Entity): { value: string; label: string }[] {
		return statusOptions(entity).filter((o) => o.value !== entity.status && o.value !== "archived");
	}

	function priorityOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];
	}

	// RowMenu「優先度: ...」: 現在値(選んでも無意味)を候補から除く。statusと違いarchived相当の除外対象は無い
	function changePriorityOptions(entity: Entity): { value: string; label: string }[] {
		const current = entity.priority ?? "";
		return priorityOptions().filter((o) => o.value !== current);
	}

	// Goal概念の廃止(design-remove-goal.md G2)によりProjectには親が無くなったため、親選択肢はticketタブ(親=project)のみが対象
	function parentOptions(): { value: string; label: string }[] {
		return plugin.store.listByType("project").map((e) => ({ value: e.path, label: e.title }));
	}

	// ---- Entity書き込み経路(design-ui-first.md §4.2): statusのみEntityService、他はEntityFieldService ----
	function commitStatus(entity: Entity, next: string): Promise<void> {
		return plugin.entityService.changeStatus(entity.path, next);
	}

	// RowMenu「▸ ステータス」からの変更: StatusCellと違い楽観的更新用の表示状態を持たないため、
	// 失敗時はStatusCellと同じNoticeのみ出す(store側の再indexで表示は変更前のstatusに戻る)
	async function changeStatusFromMenu(entity: Entity, next: string): Promise<void> {
		try {
			await commitStatus(entity, next);
		} catch {
			new Notice(t("manage.updateFailed"));
		}
	}
	function commitPriority(entity: Entity, next: string): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "priority", next);
	}

	// RowMenu「優先度: ...」からの変更: StatusCellの変更と同様、失敗時はNoticeのみ出す(store側の再indexで表示が戻る)
	async function changePriorityFromMenu(entity: Entity, next: string): Promise<void> {
		try {
			await commitPriority(entity, next);
		} catch {
			new Notice(t("manage.updateFailed"));
		}
	}
	function commitDue(entity: Entity, next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "due", next);
	}
	function commitParent(entity: Entity, next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "project", next);
	}
	function commitTitle(entity: Entity, next: string): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "title", next);
	}

	// タイトルの編集開始をRowMenu「名前を変更」からも起動できるようにする外部トリガー(TitleCell参照)
	let editTitleToken = $state(0);
	function requestRenameTitle(): void {
		editTitleToken++;
	}

	// RowMenu「Projectを変更…」: ParentCell(列)が無い画面(showParentColumn=false)からの再割り当て導線。ticketタブのみで使う
	function changeParent(entity: Entity): void {
		new ParentPickerModal(plugin.app, {
			store: plugin.store,
			onChoose: (path) => void commitParent(entity, path),
		}).open();
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

	function badgeCounts(entity: Entity): { blockers: number; comments: number; todos: number } {
		return {
			blockers: entity.blockers.length,
			comments: plugin.store.getCommentCount(entity.path),
			todos: plugin.store.getTodos(entity.path).filter((todo) => !todo.done).length,
		};
	}

	// RowMenu(⋮ボタン)とモバイル長押しメニューで同じ項目を出すための共有アクション定義(二重実装を避ける)
	function rowMenuActions(entity: Entity): RowMenuActions {
		return {
			onOpenNote: () => onOpen(entity.path),
			onShowPreview: () => showPreview(entity.path),
			statusOptions: changeStatusOptions(entity),
			onChangeStatus: (next) => void changeStatusFromMenu(entity, next),
			priorityOptions: changePriorityOptions(entity),
			onChangePriority: (next) => void changePriorityFromMenu(entity, next),
			onRename: onNavigate ? requestRenameTitle : undefined,
			onPromote: tab === "ticket" ? () => promoteEntity(entity) : undefined,
			onChangeParent: tab === "ticket" ? () => changeParent(entity) : undefined,
			changeParentLabel: tab === "ticket" ? t("manage.rowMenu.changeProject") : undefined,
			onMoveUp,
			onMoveDown,
			onArchive: () => archiveEntity(entity),
			onDelete: () => deleteEntity(entity),
		};
	}

	// モバイル(design-reorder-and-notes.md追補): 長押しでRowMenuと同内容のMenuをタッチ座標に表示する。
	// 発火後のtouchendでカードタップ(=onNavigate遷移)相当のclickは抑止される(longpress.ts側)
	function openLongPressMenu(entity: Entity, x: number, y: number): void {
		buildRowMenu(rowMenuActions(entity)).showAtPosition({ x, y });
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
		class:pos-manage-row-drag-insert-before={dragInsertBefore}
		class:pos-manage-row-drag-insert-after={dragInsertAfter}
		onclick={() => onNavigate?.(entity.path)}
		ondragover={onDragOverRow}
		ondragleave={onDragLeaveRow}
		ondrop={onDropRow}
		use:longpress={{ enabled: Platform.isMobile, onLongPress: (x, y) => openLongPressMenu(entity, x, y) }}
	>
		<td
			class="pos-manage-cell-drag"
			class:pos-manage-cell-drag-active={sort.key === "manual"}
			class:pos-manage-cell-drag-disabled={sort.key !== "manual"}
			draggable={sort.key === "manual"}
			ondragstart={sort.key === "manual" ? onDragStartRow : undefined}
			onclick={(e) => e.stopPropagation()}
			title={sort.key === "manual" ? t("manage.reorder.dragHandle") : t("manage.reorder.dragHandleDisabled")}
			aria-label={sort.key === "manual" ? t("manage.reorder.dragHandle") : t("manage.reorder.dragHandleDisabled")}
		>
			⠿
		</td>
		<td class="pos-manage-cell-title" onclick={(e) => e.stopPropagation()}>
			<TitleCell
				value={entity.title}
				onCommit={(next) => commitTitle(entity, next)}
				onNavigate={onNavigate ? () => onNavigate?.(entity.path) : undefined}
				editRequestToken={editTitleToken}
				app={plugin.app}
				hoverSourcePath={entity.path}
			/>
			<RowBadges blockerCount={badges.blockers} commentCount={badges.comments} todoCount={badges.todos} />
		</td>
		<td class="pos-manage-cell-status" onclick={(e) => e.stopPropagation()}>
			<StatusCell value={entity.status} options={statusOptions(entity)} onCommit={(next) => commitStatus(entity, next)} />
		</td>
		{#if showParentColumn}
			<td
				class="pos-manage-cell-parent"
				class:pos-cell-empty={!entity.project}
				onclick={(e) => e.stopPropagation()}
			>
				<ParentCell value={entity.project} options={parentOptions()} onCommit={(next) => commitParent(entity, next)} />
			</td>
		{/if}
		<td
			class="pos-manage-cell-priority"
			class:pos-cell-empty={!entity.priority}
			onclick={(e) => e.stopPropagation()}
		>
			<PriorityCell value={entity.priority ?? ""} options={priorityOptions()} onCommit={(next) => commitPriority(entity, next)} />
		</td>
		<td
			class="pos-manage-cell-progress"
			class:pos-cell-empty={entity.type === "goal" || fraction.total === 0}
			onclick={(e) => e.stopPropagation()}
		>
			{#if entity.type !== "goal"}
				<ProgressIndicator progress={entity.progress ?? 0} done={fraction.done} total={fraction.total} />
			{/if}
		</td>
		<td class="pos-manage-cell-due" class:pos-cell-empty={!entity.due} onclick={(e) => e.stopPropagation()}>
			<DateCell value={entity.due} onCommit={(next) => commitDue(entity, next)} relative />
		</td>
		<td class="pos-manage-cell-labels" onclick={(e) => e.stopPropagation()}>
			{#each entity.labels as label (label)}
				<span class="pos-manage-chip pos-manage-chip-static">{label}</span>
			{/each}
		</td>
		<td class="pos-manage-cell-actions" onclick={(e) => e.stopPropagation()}>
			<RowMenu {...rowMenuActions(entity)} />
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
