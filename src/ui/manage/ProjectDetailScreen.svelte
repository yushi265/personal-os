<script lang="ts">
	import type { Entity } from "../../domain/entity";
	import { PRIORITIES, validStatusesOf } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import DateCell from "../components/DateCell.svelte";
	import ParentCell from "../components/ParentCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import TodoList from "../components/TodoList.svelte";
	import MemoSection from "../components/MemoSection.svelte";
	import ManageFilterBar from "./ManageFilterBar.svelte";
	import ManageTable from "./ManageTable.svelte";
	import type { ManageScreen } from "./manageNav";
	import { buildProjectTicketRows, collectProjectTodos, type ManageFilter, type ManageSort, type ManageSortKey } from "./manageData";

	/**
	 * プロジェクト詳細画面(design-drilldown-nav.md §3.2)。
	 * ticketFilter/ticketSort/todoScope/showDoneTodosはこのスタックフレーム固有の状態(§2.3)であり、
	 * onScreenChangeを通じて呼び出し元(Manage.svelte)のstack[末尾]を置き換える形で更新する。
	 */
	let {
		plugin,
		refreshTick,
		screen,
		onScreenChange,
		onNavigateTicket,
		onOpenNote,
	}: {
		plugin: PersonalOSPlugin;
		refreshTick: number;
		screen: Extract<ManageScreen, { kind: "project-detail" }>;
		onScreenChange: (next: Extract<ManageScreen, { kind: "project-detail" }>) => void;
		onNavigateTicket: (path: string) => void;
		onOpenNote: (path: string) => void;
	} = $props();

	// IndexStoreは素のMapでリアクティブでないため、refreshTickを明示的に参照して再計算のトリガとする(Manage.svelte参照)
	const entity = $derived.by(() => {
		void refreshTick;
		return plugin.store.get(screen.path);
	});
	const ticketRows = $derived.by(() => {
		void refreshTick;
		return buildProjectTicketRows(plugin, screen.path, screen.ticketFilter, screen.ticketSort);
	});
	const todos = $derived.by(() => {
		void refreshTick;
		return collectProjectTodos(plugin.store, screen.path, screen.todoScope);
	});

	function statusOptions(e: Entity): { value: string; label: string }[] {
		const valid = validStatusesOf(e.type) ?? [e.status];
		const names: Record<string, string> | undefined = plugin.settings.kanbanColumnNames.project;
		return valid.map((s) => ({ value: s, label: names?.[s] ?? s }));
	}

	function priorityOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];
	}

	function goalOptions(): { value: string; label: string }[] {
		return plugin.store.listByType("goal").map((e) => ({ value: e.path, label: e.title }));
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
	function commitDue(next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "due", next);
	}
	function commitGoal(next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "goal", next);
	}

	function changeTicketFilter(next: ManageFilter): void {
		onScreenChange({ ...screen, ticketFilter: next });
	}

	function changeTicketSort(key: ManageSortKey): void {
		const next: ManageSort =
			screen.ticketSort.key === key
				? { key, order: screen.ticketSort.order === "asc" ? "desc" : "asc" }
				: { key, order: "asc" };
		onScreenChange({ ...screen, ticketSort: next });
	}

	function setTodoScope(scope: "direct" | "all"): void {
		onScreenChange({ ...screen, todoScope: scope });
	}

	function toggleShowDoneTodos(next: boolean): void {
		onScreenChange({ ...screen, showDoneTodos: next });
	}

	function createTicket(): void {
		new CreateEntityModal(plugin.app, {
			entityService: plugin.entityService,
			store: plugin.store,
			settings: plugin.settings,
			initialType: "ticket",
			initialParentPath: screen.path,
			openAfterCreate: false,
		}).open();
	}
</script>

{#if entity}
	<div class="pos-preview-header">
		<h2 class="pos-preview-title">
			<TitleCell value={entity.title} onCommit={commitTitle} />
		</h2>
		<span class="pos-preview-type-badge">{entity.type}</span>
	</div>

	<dl class="pos-preview-fields">
		<dt>{t("preview.field.status")}</dt>
		<dd><StatusCell value={entity.status} options={statusOptions(entity)} onCommit={commitStatus} /></dd>

		<dt>{t("preview.field.priority")}</dt>
		<dd><PriorityCell value={entity.priority ?? ""} options={priorityOptions()} onCommit={commitPriority} /></dd>

		<dt>{t("preview.field.due")}</dt>
		<dd><DateCell value={entity.due} onCommit={commitDue} /></dd>

		<dt>{t("preview.field.goal")}</dt>
		<dd><ParentCell value={entity.goal} options={goalOptions()} onCommit={commitGoal} /></dd>

		<dt>{t("preview.field.progress")}</dt>
		<dd>
			<div class="pos-progress-cell">
				<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
					<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
				</div>
				<span class="pos-progress-label">{entity.progress ?? 0}%</span>
			</div>
		</dd>
	</dl>

	<div class="pos-preview-actions">
		<button onclick={() => onOpenNote(screen.path)}>{t("manage.nav.openNote")}</button>
	</div>

	<section class="pos-manage-detail-section">
		<h3>{t("manage.tab.tickets")}</h3>
		<ManageFilterBar {plugin} tab="ticket" filter={screen.ticketFilter} onChange={changeTicketFilter} showParentFilter={false} />
		<ManageTable
			tab="ticket"
			rows={ticketRows}
			sort={screen.ticketSort}
			{plugin}
			onSortChange={changeTicketSort}
			onOpen={onOpenNote}
			onNavigate={onNavigateTicket}
		/>
		<button class="pos-manage-new-btn" onclick={createTicket}>{t("manage.projectDetail.newTicket")}</button>
	</section>

	{#if plugin.capability.todoFeatures}
		<section class="pos-manage-detail-section">
			<h3>{t("preview.section.todos")}</h3>
			<div class="pos-manage-chip-group" role="group" aria-label={t("manage.projectDetail.todoScope")}>
				<button
					type="button"
					class="pos-manage-chip"
					class:pos-manage-chip-active={screen.todoScope === "direct"}
					onclick={() => setTodoScope("direct")}
				>
					{t("manage.projectDetail.scopeDirect")}
				</button>
				<button
					type="button"
					class="pos-manage-chip"
					class:pos-manage-chip-active={screen.todoScope === "all"}
					onclick={() => setTodoScope("all")}
				>
					{t("manage.projectDetail.scopeAll")}
				</button>
			</div>
			<label class="pos-manage-filter-toggle">
				<input
					type="checkbox"
					checked={screen.showDoneTodos}
					onchange={(e) => toggleShowDoneTodos((e.target as HTMLInputElement).checked)}
				/>
				{t("manage.filter.showDone")}
			</label>
			<TodoList
				{plugin}
				{todos}
				showDone={screen.showDoneTodos}
				showParentBadge={screen.todoScope === "all"}
				addTarget={screen.path}
				onParentClick={onNavigateTicket}
			/>
		</section>
	{:else}
		<div class="pos-widget pos-widget-banner">
			<p>{t("manage.todoDisabledNotice")}</p>
		</div>
	{/if}

	<section class="pos-manage-detail-section">
		<h3>{t("preview.section.memo")}</h3>
		<MemoSection {plugin} path={screen.path} />
	</section>
{/if}
