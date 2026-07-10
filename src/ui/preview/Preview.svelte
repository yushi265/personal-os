<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { archivedUndoNotice, deletedUndoNotice, previewParseErrorMessage, t } from "../../i18n/ja";
	import type { PreviewData } from "./previewData";
	import type { Entity } from "../../domain/entity";
	import { PRIORITIES, REVIEW_CYCLES, validStatusesOf } from "../../domain/entity";
	import type { Todo } from "../../domain/todo";
	import { collectKnownLabels, collectKnownTags, entityProgressFraction } from "../manage/manageData";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import { PromoteTicketModal } from "../modals/PromoteModal";
	import { ReviewModal } from "../modals/ReviewModal";
	import { showUndoNotice } from "../undoNotice";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import DateCell from "../components/DateCell.svelte";
	import ParentCell from "../components/ParentCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import TagChips from "../components/TagChips.svelte";
	import TodoList from "../components/TodoList.svelte";
	import NotePanel from "../components/NotePanel.svelte";
	import CommentSection from "../components/CommentSection.svelte";
	import ProgressIndicator from "../components/ProgressIndicator.svelte";
	import DueLabel from "../components/DueLabel.svelte";

	let {
		plugin,
		data,
	}: {
		plugin: PersonalOSPlugin;
		data: Writable<PreviewData>;
	} = $props();

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	// ---- 選択肢構築(ManageRow.svelteの実装を踏襲、design-ui-first.md §3.1) ----
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

	function reviewCycleOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...REVIEW_CYCLES.map((c) => ({ value: c, label: c }))];
	}

	function goalOptions(): { value: string; label: string }[] {
		return plugin.store.listByType("goal").map((e) => ({ value: e.path, label: e.title }));
	}

	function projectOptions(): { value: string; label: string }[] {
		return plugin.store.listByType("project").map((e) => ({ value: e.path, label: e.title }));
	}

	// ---- 書き込み経路(design-ui-first.md §4.2): statusのみEntityService、他はEntityFieldService ----
	function commitStatus(entity: Entity, next: string): Promise<void> {
		return plugin.entityService.changeStatus(entity.path, next);
	}
	function commitPriority(entity: Entity, next: string): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "priority", next);
	}
	function commitDue(entity: Entity, next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "due", next);
	}
	function commitStart(entity: Entity, next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "start", next);
	}
	function commitReviewCycle(entity: Entity, next: string): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "reviewCycle", next);
	}
	function commitGoal(entity: Entity, next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "goal", next);
	}
	function commitProject(entity: Entity, next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "project", next);
	}
	function commitTitle(entity: Entity, next: string): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "title", next);
	}
	function commitTags(entity: Entity, next: string[]): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "tags", next);
	}
	function commitLabels(entity: Entity, next: string[]): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "labels", next);
	}
	function commitChildStatus(child: Entity, next: string): Promise<void> {
		return plugin.entityService.changeStatus(child.path, next);
	}
	function cancelTodo(todo: Todo, cancelled: boolean): void {
		void plugin.todoService.setCancelled(todo, cancelled);
	}

	// ---- 操作行(design-ui-first.md §4.2) ----
	async function archiveEntity(entity: Entity): Promise<void> {
		const originalPath = entity.path;
		const originalStatus = entity.status;
		const newPath = await plugin.entityService.archive(originalPath);
		showUndoNotice(archivedUndoNotice(entity.title), () =>
			plugin.entityService.restoreFromArchive(newPath, originalPath, originalStatus)
		);
	}

	function promoteEntity(entity: Entity): void {
		new PromoteTicketModal(plugin.app, {
			promoteService: plugin.promoteService,
			ticketPath: entity.path,
			ticketTitle: entity.title,
		}).open();
	}

	async function deleteEntity(entity: Entity): Promise<void> {
		const savedContent = await plugin.repo.readBody(entity.path);
		await plugin.entityService.delete(entity.path);
		showUndoNotice(deletedUndoNotice(entity.title), async () => {
			await plugin.repo.restoreFile(entity.path, savedContent);
		});
	}

	function openReview(entity: Entity): void {
		new ReviewModal(plugin.app, {
			reviewService: plugin.reviewService,
			target: entity,
			defaultCycle: plugin.settings.defaultReviewCycle,
		}).open();
	}

	function createChild(entity: Entity): void {
		new CreateEntityModal(plugin.app, {
			entityService: plugin.entityService,
			store: plugin.store,
			settings: plugin.settings,
			initialType: entity.type === "goal" ? "project" : "ticket",
			initialParentPath: entity.path,
			openAfterCreate: false,
		}).open();
	}

	// ---- Todoセクション(design-drilldown-nav.md §3.4): 表示・操作は共通部品TodoListに委譲する ----
	// 完了済み表示トグル(共通化の副次効果でPreviewに新設、design-drilldown-nav.md §3.4)
	let showDoneTodos = $state(false);
</script>

<div class="pos-preview">
	{#if $data.entity === null}
		{#if $data.parseError}
			<div class="pos-widget pos-widget-danger">
				<p>{previewParseErrorMessage($data.parseError)}</p>
			</div>
			{#if $data.path}
				{@const path = $data.path}
				<span
					class="pos-widget-item-text"
					role="link"
					tabindex="0"
					onclick={() => openPath(path)}
					onkeydown={(e) => e.key === "Enter" && openPath(path)}
				>
					{t("preview.body.openNote")}
				</span>
			{/if}
		{:else}
			<p class="pos-widget-empty">{t("preview.empty")}</p>
		{/if}
	{:else}
		{@const entity = $data.entity}
		<div class="pos-preview-header">
			<h2 class="pos-preview-title">
				<TitleCell value={entity.title} onCommit={(next) => commitTitle(entity, next)} />
			</h2>
			<span class="pos-preview-type-badge">{entity.type}</span>
		</div>

		<details class="pos-preview-section" open>
			<summary>{t("preview.section.detail")}</summary>
			<dl class="pos-preview-fields">
				<dt>{t("preview.field.status")}</dt>
				<dd><StatusCell value={entity.status} options={statusOptions(entity)} onCommit={(next) => commitStatus(entity, next)} /></dd>

				<dt>{t("preview.field.priority")}</dt>
				<dd>
					<PriorityCell value={entity.priority ?? ""} options={priorityOptions()} onCommit={(next) => commitPriority(entity, next)} />
				</dd>

				{#if entity.type === "project" || entity.type === "ticket"}
					{@const fraction = entityProgressFraction(plugin.store, entity)}
					<dt>{t("preview.field.progress")}</dt>
					<dd><ProgressIndicator progress={entity.progress ?? 0} done={fraction.done} total={fraction.total} /></dd>
				{/if}

				<dt>{t("preview.field.due")}</dt>
				<dd><DateCell value={entity.due} onCommit={(next) => commitDue(entity, next)} relative /></dd>

				<dt>{t("preview.field.start")}</dt>
				<dd><DateCell value={entity.start} onCommit={(next) => commitStart(entity, next)} /></dd>

				{#if entity.type === "project"}
					<dt>{t("preview.field.goal")}</dt>
					<dd><ParentCell value={entity.goal} options={goalOptions()} onCommit={(next) => commitGoal(entity, next)} /></dd>
				{/if}

				{#if entity.type === "ticket"}
					<dt>{t("preview.field.project")}</dt>
					<dd><ParentCell value={entity.project} options={projectOptions()} onCommit={(next) => commitProject(entity, next)} /></dd>
				{/if}
			</dl>
		</details>

		<details class="pos-preview-section" open={entity.tags.length > 0}>
			<summary>{t("preview.section.tags")}</summary>
			<TagChips values={entity.tags} suggestions={collectKnownTags(plugin.store)} onCommit={(next) => commitTags(entity, next)} />
		</details>

		<details class="pos-preview-section" open={entity.labels.length > 0}>
			<summary>{t("preview.section.labels")}</summary>
			<TagChips values={entity.labels} suggestions={collectKnownLabels(plugin.store)} onCommit={(next) => commitLabels(entity, next)} />
		</details>

		{#if plugin.capability.todoFeatures}
			<details class="pos-preview-section">
				<summary>{t("preview.section.todos")}</summary>
				<label class="pos-manage-filter-toggle">
					<input
						type="checkbox"
						checked={showDoneTodos}
						onchange={(e) => (showDoneTodos = (e.target as HTMLInputElement).checked)}
					/>
					{t("manage.filter.showDone")}
				</label>
				<TodoList {plugin} todos={$data.todos} showDone={showDoneTodos} addTarget={entity.path} onCancel={cancelTodo} />
			</details>
		{:else}
			<div class="pos-widget pos-widget-banner">
				<p>{t("preview.todoDisabledNotice")}</p>
			</div>
		{/if}

		<details class="pos-preview-section">
			<summary>{t("preview.section.note")}</summary>
			<NotePanel {plugin} path={entity.path} />
		</details>

		<details class="pos-preview-section">
			<summary>{t("preview.section.comment")}</summary>
			<CommentSection {plugin} path={entity.path} />
		</details>

		<details class="pos-preview-section" open>
			<summary>{t("preview.section.children")}</summary>
			{#if $data.children.length === 0}
				<p class="pos-widget-empty">{t("preview.empty.children")}</p>
			{:else}
				<ul class="pos-widget-list">
					{#each $data.children as child (child.path)}
						<li class="pos-widget-item pos-preview-child-row">
							<span
								class="pos-widget-item-text"
								role="link"
								tabindex="0"
								onclick={() => openPath(child.path)}
								onkeydown={(e) => e.key === "Enter" && openPath(child.path)}
							>
								▸ {child.title}
							</span>
							<DueLabel value={child.due} />
							{#if child.type !== "goal"}
								{@const childFraction = entityProgressFraction(plugin.store, child)}
								<ProgressIndicator progress={child.progress ?? 0} done={childFraction.done} total={childFraction.total} />
							{/if}
							<StatusCell value={child.status} options={statusOptions(child)} onCommit={(next) => commitChildStatus(child, next)} />
						</li>
					{/each}
				</ul>
			{/if}
			{#if entity.type !== "ticket"}
				<button class="pos-manage-new-btn" onclick={() => createChild(entity)}>{t("manage.newButton")}</button>
			{/if}
		</details>

		{#if entity.type === "project" || entity.type === "goal"}
			<details class="pos-preview-section" open={!!entity.reviewCycle || !!entity.lastReviewed}>
				<summary>{t("preview.section.review")}</summary>
				<dl class="pos-preview-fields">
					<dt>{t("preview.field.reviewCycle")}</dt>
					<dd>
						<StatusCell
							value={entity.reviewCycle ?? ""}
							options={reviewCycleOptions()}
							onCommit={(next) => commitReviewCycle(entity, next)}
						/>
					</dd>
					<dt>{t("preview.field.lastReviewed")}</dt>
					<dd>{entity.lastReviewed ?? t("manage.field.unset")}</dd>
				</dl>
				<button class="pos-manage-new-btn" onclick={() => openReview(entity)}>{t("preview.action.review")}</button>
			</details>
		{/if}

		<div class="pos-preview-actions">
			<div class="pos-preview-actions-primary">
				<button class="mod-cta" onclick={() => archiveEntity(entity)}>{t("preview.action.archive")}</button>
				{#if entity.type === "ticket"}
					<button onclick={() => promoteEntity(entity)}>{t("preview.action.promote")}</button>
				{/if}
			</div>
			<button class="pos-btn-danger-ghost" onclick={() => deleteEntity(entity)}>{t("preview.action.delete")}</button>
		</div>

		{#if Object.keys(entity.extra).length > 0}
			<details class="pos-preview-section" open>
				<summary>{t("preview.section.unknown")}</summary>
				<dl class="pos-preview-fields">
					{#each Object.entries(entity.extra) as [key, value] (key)}
						<dt>{key}</dt>
						<dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
					{/each}
				</dl>
			</details>
		{/if}

		<details class="pos-preview-section" open={$data.bodyLines.some((l) => l.trim() !== "")}>
			<summary>{t("preview.section.body")}</summary>
			{#if $data.bodyLines.every((l) => l.trim() === "")}
				<p class="pos-widget-empty">{t("preview.empty.body")}</p>
			{:else}
				<pre class="pos-preview-body">{$data.bodyLines.join("\n")}</pre>
			{/if}
			<span
				class="pos-widget-item-text"
				role="link"
				tabindex="0"
				onclick={() => openPath(entity.path)}
				onkeydown={(e) => e.key === "Enter" && openPath(entity.path)}
			>
				{t("preview.body.openNote")}
			</span>
		</details>
	{/if}
</div>
