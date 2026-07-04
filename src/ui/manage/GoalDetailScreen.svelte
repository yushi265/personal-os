<script lang="ts">
	import { Notice } from "obsidian";
	import type { Entity } from "../../domain/entity";
	import { PRIORITIES, REVIEW_CYCLES, validStatusesOf } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { archivedUndoNotice, deletedUndoNotice, entityCreatedNotice, t } from "../../i18n/ja";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import { ReviewModal } from "../modals/ReviewModal";
	import { showUndoNotice } from "../undoNotice";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import TagChips from "../components/TagChips.svelte";
	import BlockerList from "../components/BlockerList.svelte";
	import NotePanel from "../components/NotePanel.svelte";
	import CommentSection from "../components/CommentSection.svelte";
	import ManageFilterBar from "./ManageFilterBar.svelte";
	import ManageTable from "./ManageTable.svelte";
	import InlineCreateRow from "./InlineCreateRow.svelte";
	import type { ManageScreen } from "./manageNav";
	import {
		buildGoalProjectRows,
		collectKnownLabels,
		collectKnownTags,
		goalGroupProgress,
		type ManageFilter,
		type ManageSort,
		type ManageSortKey,
	} from "./manageData";

	/**
	 * Goal詳細画面(ユーザー指摘: Goalの編集・削除がノートを開く以外にできない導線の穴を埋める)。
	 * ProjectDetailScreen.svelteの構成(ヘッダ+配下一覧+メモ+コメント)を踏襲し、
	 * Preview.svelteのReviewセクション・操作行(Archive/削除、トーンダウン済みスタイル)を移植する。
	 * projectFilter/projectSort/projectFilterExpandedはこのスタックフレーム固有の状態(§2.3、manageNav.ts参照)。
	 */
	let {
		plugin,
		refreshTick,
		screen,
		onScreenChange,
		onNavigateProject,
		onOpenNote,
		focusNewRowToken,
	}: {
		plugin: PersonalOSPlugin;
		refreshTick: number;
		screen: Extract<ManageScreen, { kind: "goal-detail" }>;
		onScreenChange: (next: Extract<ManageScreen, { kind: "goal-detail" }>) => void;
		onNavigateProject: (path: string) => void;
		onOpenNote: (path: string) => void;
		/** Manage.svelteの「n」キー操作からこの画面のインライン新規作成行へフォーカスを要求する外部トリガー(ProjectDetailScreen参照) */
		focusNewRowToken?: number;
	} = $props();

	// IndexStoreは素のMapでリアクティブでないため、refreshTickを明示的に参照して再計算のトリガとする(Manage.svelte参照)
	const entity = $derived.by(() => {
		void refreshTick;
		return plugin.store.get(screen.path);
	});
	const projectRows = $derived.by(() => {
		void refreshTick;
		return buildGoalProjectRows(plugin, screen.path, screen.projectFilter, screen.projectSort);
	});
	// ヘッダの集計進捗(ProjectListScreenのgoalGroupProgressと同ロジック): 配下project.progressの単純平均、0件はnull
	const groupProgress = $derived(goalGroupProgress(projectRows.map((r) => r.entity)));

	function statusOptions(e: Entity): { value: string; label: string }[] {
		const valid = validStatusesOf(e.type) ?? [e.status];
		const names: Record<string, string> | undefined = plugin.settings.kanbanColumnNames.project;
		return valid.map((s) => ({ value: s, label: names?.[s] ?? s }));
	}

	function priorityOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];
	}

	function reviewCycleOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...REVIEW_CYCLES.map((c) => ({ value: c, label: c }))];
	}

	// ---- 書き込み経路(design-ui-first.md §4.2): statusのみEntityService、他はEntityFieldService ----
	function commitTitle(next: string): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "title", next);
	}
	function commitStatus(next: string): Promise<void> {
		return plugin.entityService.changeStatus(screen.path, next);
	}
	function commitPriority(next: string): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "priority", next);
	}
	function commitReviewCycle(next: string): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "reviewCycle", next);
	}
	function commitTags(next: string[]): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "tags", next);
	}
	function commitLabels(next: string[]): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "labels", next);
	}
	function commitBlockers(next: string[]): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "blockers", next);
	}

	function changeProjectFilter(next: ManageFilter): void {
		onScreenChange({ ...screen, projectFilter: next });
	}

	function changeProjectFilterExpanded(next: boolean): void {
		onScreenChange({ ...screen, projectFilterExpanded: next });
	}

	function changeProjectSort(key: ManageSortKey): void {
		const next: ManageSort =
			screen.projectSort.key === key
				? { key, order: screen.projectSort.order === "asc" ? "desc" : "asc" }
				: { key, order: "asc" };
		onScreenChange({ ...screen, projectSort: next });
	}

	function createProject(): void {
		new CreateEntityModal(plugin.app, {
			entityService: plugin.entityService,
			store: plugin.store,
			settings: plugin.settings,
			initialType: "project",
			initialParentPath: screen.path,
			openAfterCreate: false,
		}).open();
	}

	// インライン新規作成(design-ui-first.md §4.2、ProjectDetailScreen.svelteのcreateTicketInlineと同パターン)
	async function createProjectInline(title: string): Promise<void> {
		await plugin.entityService.create({ type: "project", title, goal: screen.path });
		new Notice(entityCreatedNotice(title));
	}

	function openReview(e: Entity): void {
		new ReviewModal(plugin.app, {
			reviewService: plugin.reviewService,
			target: e,
			defaultCycle: plugin.settings.defaultReviewCycle,
		}).open();
	}

	// ---- 操作行(Preview.svelteの操作行と同パターン。Archive/削除いずれもUndoトースト、design-ui-first.md §4.2) ----
	async function archiveGoal(e: Entity): Promise<void> {
		const originalPath = e.path;
		const originalStatus = e.status;
		const newPath = await plugin.entityService.archive(originalPath);
		showUndoNotice(archivedUndoNotice(e.title), () =>
			plugin.entityService.restoreFromArchive(newPath, originalPath, originalStatus)
		);
	}

	async function deleteGoal(e: Entity): Promise<void> {
		const savedContent = await plugin.repo.readBody(e.path);
		await plugin.entityService.delete(e.path);
		showUndoNotice(deletedUndoNotice(e.title), async () => {
			await plugin.repo.restoreFile(e.path, savedContent);
		});
	}
</script>

{#if entity}
	<div class="pos-preview-header">
		<h2 class="pos-preview-title">
			<TitleCell value={entity.title} onCommit={commitTitle} app={plugin.app} hoverSourcePath={screen.path} />
		</h2>
		<span class="pos-preview-type-badge">{entity.type}</span>
	</div>

	<dl class="pos-preview-fields">
		<dt>{t("preview.field.status")}</dt>
		<dd><StatusCell value={entity.status} options={statusOptions(entity)} onCommit={commitStatus} /></dd>

		<dt>{t("preview.field.priority")}</dt>
		<dd><PriorityCell value={entity.priority ?? ""} options={priorityOptions()} onCommit={commitPriority} /></dd>

		<dt>{t("preview.field.reviewCycle")}</dt>
		<dd><StatusCell value={entity.reviewCycle ?? ""} options={reviewCycleOptions()} onCommit={commitReviewCycle} /></dd>

		<dt>{t("preview.field.lastReviewed")}</dt>
		<dd>{entity.lastReviewed ?? t("manage.field.unset")}</dd>

		{#if groupProgress !== null}
			<dt>{t("preview.field.progress")}</dt>
			<dd>
				<div class="pos-progress-cell">
					<div class="pos-progress-bar" aria-label="{groupProgress}%">
						<div class="pos-progress-bar-fill" style="width: {groupProgress}%"></div>
					</div>
					<span class="pos-progress-label">{groupProgress}%</span>
				</div>
			</dd>
		{/if}
	</dl>

	<div class="pos-manage-detail-section">
		<button class="pos-manage-new-btn" onclick={() => openReview(entity)}>{t("preview.action.review")}</button>
	</div>

	<section class="pos-manage-detail-section">
		<h3>{t("preview.section.tags")}</h3>
		<TagChips values={entity.tags} suggestions={collectKnownTags(plugin.store)} onCommit={commitTags} />
	</section>

	<section class="pos-manage-detail-section">
		<h3>{t("preview.section.labels")}</h3>
		<TagChips values={entity.labels} suggestions={collectKnownLabels(plugin.store)} onCommit={commitLabels} />
	</section>

	<section class="pos-manage-detail-section">
		<h3>{t("preview.section.blockers")}</h3>
		<BlockerList blockers={entity.blockers} onCommit={commitBlockers} />
	</section>

	<section class="pos-manage-detail-section">
		<h3>{t("manage.goalDetail.projects")}</h3>
		<ManageFilterBar
			{plugin}
			tab="project"
			filter={screen.projectFilter}
			onChange={changeProjectFilter}
			expanded={screen.projectFilterExpanded}
			onExpandedChange={changeProjectFilterExpanded}
			showParentFilter={false}
		/>
		<ManageTable
			tab="project"
			rows={projectRows}
			sort={screen.projectSort}
			{plugin}
			onSortChange={changeProjectSort}
			onOpen={onOpenNote}
			onNavigate={onNavigateProject}
			showParentColumn={false}
		/>
		<div class="pos-manage-create-row">
			<InlineCreateRow
				label={t("manage.nav.inlineNewProject")}
				inputPlaceholder={t("modal.createEntity.titleFieldPlaceholder")}
				onSubmit={createProjectInline}
				focusRequestToken={focusNewRowToken}
			/>
			<button class="pos-manage-new-btn" onclick={createProject}>{t("manage.nav.newProjectInGoal")}</button>
		</div>
	</section>

	<section class="pos-manage-detail-section">
		<h3>{t("preview.section.note")}</h3>
		<NotePanel {plugin} path={screen.path} />
	</section>

	<section class="pos-manage-detail-section">
		<h3>{t("preview.section.comment")}</h3>
		<CommentSection {plugin} path={screen.path} />
	</section>

	<div class="pos-preview-actions">
		<div class="pos-preview-actions-primary">
			<button class="mod-cta" onclick={() => archiveGoal(entity)}>{t("preview.action.archive")}</button>
		</div>
		<button class="pos-btn-danger-ghost" onclick={() => deleteGoal(entity)}>{t("preview.action.delete")}</button>
	</div>
{/if}
