<script lang="ts">
	import type { Entity } from "../../domain/entity";
	import { PRIORITIES, validStatusesOf } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import StatusCell from "../components/StatusCell.svelte";
	import PriorityCell from "../components/PriorityCell.svelte";
	import DateCell from "../components/DateCell.svelte";
	import ParentCell from "../components/ParentCell.svelte";
	import TitleCell from "../components/TitleCell.svelte";
	import BlockerList from "../components/BlockerList.svelte";
	import TodoList from "../components/TodoList.svelte";
	import type { ManageScreen } from "./manageNav";

	/**
	 * チケット詳細画面(design-drilldown-nav.md §3.3)。
	 * ProjectDetailScreen.svelteのヘッダ構成を踏襲しつつ、Blockersセクションを追加する。
	 * showDoneTodosのみこのスタックフレーム固有の状態(§2.3)であり、onScreenChangeを通じて
	 * 呼び出し元(Manage.svelte)のstack[末尾]を置き換える形で更新する。
	 */
	let {
		plugin,
		screen,
		onScreenChange,
		onOpenNote,
	}: {
		plugin: PersonalOSPlugin;
		screen: Extract<ManageScreen, { kind: "ticket-detail" }>;
		onScreenChange: (next: Extract<ManageScreen, { kind: "ticket-detail" }>) => void;
		onOpenNote: (path: string) => void;
	} = $props();

	const entity = $derived(plugin.store.get(screen.path));
	const todos = $derived(plugin.store.getTodos(screen.path));

	function statusOptions(e: Entity): { value: string; label: string }[] {
		const valid = validStatusesOf(e.type) ?? [e.status];
		const names: Record<string, string> | undefined = plugin.settings.kanbanColumnNames.ticket;
		return valid.map((s) => ({ value: s, label: names?.[s] ?? s }));
	}

	function priorityOptions(): { value: string; label: string }[] {
		return [{ value: "", label: t("manage.field.unset") }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];
	}

	function projectOptions(): { value: string; label: string }[] {
		return plugin.store.listByType("project").map((e) => ({ value: e.path, label: e.title }));
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
	function commitProject(next: string | undefined): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "project", next);
	}
	function commitBlockers(next: string[]): Promise<void> {
		return plugin.entityFieldService.updateField(screen.path, "blockers", next);
	}

	function toggleShowDoneTodos(next: boolean): void {
		onScreenChange({ ...screen, showDoneTodos: next });
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

		<dt>{t("preview.field.project")}</dt>
		<dd><ParentCell value={entity.project} options={projectOptions()} onCommit={commitProject} /></dd>

		<dt>{t("preview.field.progress")}</dt>
		<dd>
			<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
				<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
			</div>
			{entity.progress ?? 0}%
		</dd>
	</dl>

	<div class="pos-preview-actions">
		<button onclick={() => onOpenNote(screen.path)}>{t("manage.nav.openNote")}</button>
	</div>

	<section class="pos-manage-detail-section">
		<h3>{t("preview.section.blockers")}</h3>
		<BlockerList blockers={entity.blockers} onCommit={commitBlockers} />
	</section>

	{#if plugin.capability.todoFeatures}
		<section class="pos-manage-detail-section">
			<h3>{t("preview.section.todos")}</h3>
			<label class="pos-manage-filter-toggle">
				<input
					type="checkbox"
					checked={screen.showDoneTodos}
					onchange={(e) => toggleShowDoneTodos((e.target as HTMLInputElement).checked)}
				/>
				{t("manage.filter.showDone")}
			</label>
			<TodoList {plugin} {todos} showDone={screen.showDoneTodos} showParentBadge={false} addTarget={screen.path} />
		</section>
	{:else}
		<div class="pos-widget pos-widget-banner">
			<p>{t("manage.todoDisabledNotice")}</p>
		</div>
	{/if}
{/if}
