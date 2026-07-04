<script lang="ts">
	import { Notice } from "obsidian";
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { manageDeleteConfirmMessage, previewParseErrorMessage, t } from "../../i18n/ja";
	import type { PreviewData } from "./previewData";
	import type { Entity, Priority } from "../../domain/entity";
	import { PRIORITIES, REVIEW_CYCLES, validStatusesOf } from "../../domain/entity";
	import type { Todo } from "../../domain/todo";
	import { collectKnownLabels, collectKnownTags } from "../manage/manageData";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import { PromoteTicketModal, PromoteTodoModal } from "../modals/PromoteModal";
	import { ReviewModal } from "../modals/ReviewModal";
	import { ConfirmModal } from "../modals/ConfirmModal";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import DateCell from "../components/DateCell.svelte";
	import ParentCell from "../components/ParentCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import TagChips from "../components/TagChips.svelte";
	import BlockerList from "../components/BlockerList.svelte";

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
	function commitBlockers(entity: Entity, next: string[]): Promise<void> {
		return plugin.entityFieldService.updateField(entity.path, "blockers", next);
	}
	function commitChildStatus(child: Entity, next: string): Promise<void> {
		return plugin.entityService.changeStatus(child.path, next);
	}

	// ---- 操作行(design-ui-first.md §4.2) ----
	function archiveEntity(entity: Entity): void {
		void plugin.entityService.archive(entity.path);
	}

	function promoteEntity(entity: Entity): void {
		new PromoteTicketModal(plugin.app, {
			promoteService: plugin.promoteService,
			ticketPath: entity.path,
			ticketTitle: entity.title,
		}).open();
	}

	function deleteEntity(entity: Entity): void {
		new ConfirmModal(plugin.app, {
			message: manageDeleteConfirmMessage(entity.title),
			onConfirm: () => plugin.entityService.delete(entity.path),
		}).open();
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
		}).open();
	}

	// ---- Todoセクション(design-ui-first.md §4.1/§4.2/§4.4) ----
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

	// フッタ「+ Todoを追加」フォーム(design-ui-first.md §4.4、失敗時は入力内容を保持する)
	let newTodoText = $state("");
	let newTodoDue = $state("");
	let newTodoPriority = $state("");

	async function submitAddTodo(entity: Entity): Promise<void> {
		const text = newTodoText.trim();
		if (!text) {
			new Notice(t("preview.todoAdd.textRequired"));
			return;
		}
		try {
			await plugin.todoService.addToSection(entity.path, {
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
					<dt>{t("preview.field.progress")}</dt>
					<dd>
						<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
							<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
						</div>
						{entity.progress ?? 0}%
					</dd>
				{/if}

				<dt>{t("preview.field.due")}</dt>
				<dd><DateCell value={entity.due} onCommit={(next) => commitDue(entity, next)} /></dd>

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

		<details class="pos-preview-section" open={entity.blockers.length > 0}>
			<summary>{t("preview.section.blockers")}</summary>
			<BlockerList blockers={entity.blockers} onCommit={(next) => commitBlockers(entity, next)} />
		</details>

		{#if plugin.capability.todoFeatures}
			<details class="pos-preview-section">
				<summary>{t("preview.section.todos")}</summary>
				{#if $data.todos.length === 0}
					<p class="pos-widget-empty">{t("preview.empty.todos")}</p>
				{:else}
					<ul class="pos-widget-list">
						{#each $data.todos as todo (todo.filePath + "#" + todo.line)}
							<li class="pos-widget-item pos-preview-todo-row">
								<input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo)} />
								<span class="pos-preview-todo-text">
									<TitleCell value={todo.text} onCommit={(next) => commitTodoText(todo, next)} />
								</span>
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
				<form
					class="pos-preview-todo-add"
					onsubmit={(e) => {
						e.preventDefault();
						void submitAddTodo(entity);
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
			</details>
		{:else}
			<div class="pos-widget pos-widget-banner">
				<p>{t("preview.todoDisabledNotice")}</p>
			</div>
		{/if}

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
			<button onclick={() => archiveEntity(entity)}>{t("preview.action.archive")}</button>
			{#if entity.type === "ticket"}
				<button onclick={() => promoteEntity(entity)}>{t("preview.action.promote")}</button>
			{/if}
			<button class="mod-warning" onclick={() => deleteEntity(entity)}>{t("preview.action.delete")}</button>
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
