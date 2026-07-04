<script lang="ts">
	import type { Entity } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import ManageFilterBar from "./ManageFilterBar.svelte";
	import ManageTable from "./ManageTable.svelte";
	import { groupProjectsByGoal, type ManageFilter, type ManageRowData, type ManageSort, type ManageSortKey } from "./manageData";

	let {
		plugin,
		refreshTick,
		filter,
		sort,
		collapsedGoals,
		onFilterChange,
		onSortChange,
		onToggleGoal,
		onNavigate,
	}: {
		plugin: PersonalOSPlugin;
		refreshTick: number;
		filter: ManageFilter;
		sort: ManageSort;
		collapsedGoals: Set<string>;
		onFilterChange: (next: ManageFilter) => void;
		onSortChange: (key: ManageSortKey) => void;
		onToggleGoal: (key: string) => void;
		onNavigate: (path: string) => void;
	} = $props();

	// IndexStoreは素のMapでリアクティブでないため、refreshTickを明示的に参照して再計算のトリガとする(Manage.svelte参照)
	const groups = $derived.by(() => {
		void refreshTick;
		return groupProjectsByGoal(plugin, filter, sort);
	});

	function groupKey(goal: Entity | null): string {
		return goal?.path ?? "__unclassified__";
	}

	function toRows(entities: Entity[]): ManageRowData[] {
		return entities.map((entity) => ({ kind: "entity" as const, entity }));
	}

	function openNote(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	function createProject(goalPath: string | undefined): void {
		new CreateEntityModal(plugin.app, {
			entityService: plugin.entityService,
			store: plugin.store,
			settings: plugin.settings,
			initialType: "project",
			initialParentPath: goalPath,
			openAfterCreate: false,
		}).open();
	}
</script>

<ManageFilterBar {plugin} tab="project" {filter} onChange={onFilterChange} showParentFilter={false} />

{#if groups.length === 0}
	<div class="pos-manage-empty-state">
		<span class="pos-manage-empty-icon" aria-hidden="true">🗂️</span>
		<p class="pos-manage-empty">{t("manage.emptyState")}</p>
		<button class="pos-manage-empty-action" onclick={() => createProject(undefined)}>{t("manage.nav.newProject")}</button>
	</div>
{:else}
	{#each groups as group (groupKey(group.goal))}
		{@const key = groupKey(group.goal)}
		{@const collapsed = collapsedGoals.has(key)}
		<section class="pos-manage-goal-section">
			<button class="pos-manage-goal-header" onclick={() => onToggleGoal(key)}>
				<span class="pos-manage-goal-toggle" class:pos-manage-goal-toggle-open={!collapsed}>▶</span>
				<span class="pos-manage-goal-title">{group.goal?.title ?? t("manage.nav.unclassified")}</span>
				{#if group.goal}<span class="pos-manage-goal-status">{group.goal.status}</span>{/if}
				<span class="pos-manage-goal-count">{group.projects.length}{t("manage.nav.itemsSuffix")}</span>
			</button>
			{#if !collapsed}
				<ManageTable
					tab="project"
					rows={toRows(group.projects)}
					{sort}
					{plugin}
					{onSortChange}
					onOpen={openNote}
					{onNavigate}
				/>
				<button class="pos-manage-goal-new-btn" onclick={() => createProject(group.goal?.path)}>
					{t("manage.nav.newProjectInGoal")}
				</button>
			{/if}
		</section>
	{/each}
{/if}
