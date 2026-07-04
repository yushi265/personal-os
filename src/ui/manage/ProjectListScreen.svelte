<script lang="ts">
	import { Notice } from "obsidian";
	import type { Snippet } from "svelte";
	import type { Entity } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { entityCreatedNotice, t } from "../../i18n/ja";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import ManageFilterBar from "./ManageFilterBar.svelte";
	import ManageTable from "./ManageTable.svelte";
	import InlineCreateRow from "./InlineCreateRow.svelte";
	import {
		computeCrossGroupOrder,
		firstExpandedGroupIndex,
		goalGroupProgress,
		groupProjectsByGoal,
		isManageVaultEmpty,
		type GoalGroup,
		type ManageFilter,
		type ManageRowData,
		type ManageSort,
		type ManageSortKey,
	} from "./manageData";

	let {
		plugin,
		refreshTick,
		filter,
		sort,
		collapsedGoals,
		filterExpanded,
		onFilterChange,
		onFilterExpandedChange,
		onSortChange,
		onToggleGoal,
		onNavigate,
		toolbarExtra,
		focusNewRowToken,
	}: {
		plugin: PersonalOSPlugin;
		refreshTick: number;
		filter: ManageFilter;
		sort: ManageSort;
		collapsedGoals: Set<string>;
		filterExpanded: boolean;
		onFilterChange: (next: ManageFilter) => void;
		onFilterExpandedChange: (next: boolean) => void;
		onSortChange: (key: ManageSortKey) => void;
		onToggleGoal: (key: string) => void;
		onNavigate: (path: string) => void;
		toolbarExtra?: Snippet;
		/** Manage.svelteの「n」キー操作から先頭のGoalセクションのインライン新規作成行へフォーカスを要求する(Phase U2) */
		focusNewRowToken?: number;
	} = $props();

	// IndexStoreは素のMapでリアクティブでないため、refreshTickを明示的に参照して再計算のトリガとする(Manage.svelte参照)
	const groups = $derived.by(() => {
		void refreshTick;
		return groupProjectsByGoal(plugin, filter, sort);
	});

	// オンボーディング判定(Phase U3): Vault内にGoal/Projectが1件も無い初回起動状態かどうか。フィルタ結果とは独立に判定する
	const isVaultEmpty = $derived.by(() => {
		void refreshTick;
		return isManageVaultEmpty(plugin.store);
	});

	function groupKey(goal: Entity | null): string {
		return goal?.path ?? "__unclassified__";
	}

	// 「n」キーでのインライン新規作成フォーカス(Phase U2→U3改善): 先頭固定ではなく、
	// 展開中(折りたたまれていない)最初のGoalセクションを優先する(判定はmanageData.tsの純粋関数、テスト参照)
	const focusGroupIndex = $derived(firstExpandedGroupIndex(groups, collapsedGoals));

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

	// オンボーディング(Phase U3): 初回起動時の「最初のGoalを作成」ボタン
	function createFirstGoal(): void {
		new CreateEntityModal(plugin.app, {
			entityService: plugin.entityService,
			store: plugin.store,
			settings: plugin.settings,
			initialType: "goal",
		}).open();
	}

	// インライン新規作成(design-ui-first.md §4.2、Phase U2): status=backlog等の他フィールドはEntityService.createのデフォルトに委ねる
	async function createProjectInline(goalPath: string | undefined, title: string): Promise<void> {
		await plugin.entityService.create({ type: "project", title, goal: goalPath });
		new Notice(entityCreatedNotice(title));
	}

	/**
	 * Goal跨ぎドロップ(design-reorder-and-notes.md A-4, T-6): ドロップ先セクションのgoalが元と異なる場合、
	 * goal付け替え+ドロップ位置に応じたorder設定を1回のfrontmatter書き込みにまとめる。
	 */
	function handleCrossGroupDrop(group: GoalGroup, path: string, targetIndex: number, position: "before" | "after"): void {
		const targetRows = group.projects.map((p) => ({ path: p.path, order: p.order }));
		const newOrder = computeCrossGroupOrder(targetRows, targetIndex, position);
		void plugin.entityFieldService
			.reorderAndReassignGoal(path, newOrder, group.goal?.path)
			.catch(() => new Notice(t("manage.updateFailed")));
	}
</script>

<ManageFilterBar
	{plugin}
	tab="project"
	{filter}
	onChange={onFilterChange}
	expanded={filterExpanded}
	onExpandedChange={onFilterExpandedChange}
	showParentFilter={false}
	{toolbarExtra}
/>

{#if isVaultEmpty}
	<div class="pos-manage-onboarding">
		<h3 class="pos-manage-onboarding-title">{t("onboarding.welcome.title")}</h3>
		<ol class="pos-manage-onboarding-steps">
			<li>{t("onboarding.welcome.step1")}</li>
			<li>{t("onboarding.welcome.step2")}</li>
			<li>{t("onboarding.welcome.step3")}</li>
		</ol>
		<button type="button" class="pos-manage-onboarding-action" onclick={createFirstGoal}>
			{t("onboarding.welcome.createGoal")}
		</button>
	</div>
{:else if groups.length === 0}
	<div class="pos-manage-empty-state">
		<span class="pos-manage-empty-icon" aria-hidden="true">🗂️</span>
		<p class="pos-manage-empty">{t("manage.emptyState")}</p>
		<button class="pos-manage-empty-action" onclick={() => createProject(undefined)}>{t("manage.nav.newProject")}</button>
	</div>
{:else}
	{#each groups as group, groupIndex (groupKey(group.goal))}
		{@const key = groupKey(group.goal)}
		{@const collapsed = collapsedGoals.has(key)}
		{@const groupProgress = goalGroupProgress(group.projects)}
		<section class="pos-manage-goal-section">
			<button class="pos-manage-goal-header" onclick={() => onToggleGoal(key)}>
				<span class="pos-manage-goal-toggle" class:pos-manage-goal-toggle-open={!collapsed}>▶</span>
				<span class="pos-manage-goal-title">{group.goal?.title ?? t("manage.nav.unclassified")}</span>
				{#if group.goal}<span class="pos-manage-goal-status">{group.goal.status}</span>{/if}
				<span class="pos-manage-goal-count">{group.projects.length}{t("manage.nav.itemsSuffix")}</span>
				{#if groupProgress !== null}
					<span class="pos-progress-cell pos-manage-goal-progress">
						<span class="pos-progress-bar" aria-label="{groupProgress}%">
							<span class="pos-progress-bar-fill" style="width: {groupProgress}%"></span>
						</span>
						<span class="pos-progress-label">{groupProgress}%</span>
					</span>
				{/if}
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
					showParentColumn={false}
					onCrossDrop={(path, targetIndex, position) => handleCrossGroupDrop(group, path, targetIndex, position)}
				/>
				<div class="pos-manage-create-row">
					<InlineCreateRow
						label={t("manage.nav.inlineNewProject")}
						inputPlaceholder={t("modal.createEntity.titleFieldPlaceholder")}
						onSubmit={(title) => createProjectInline(group.goal?.path, title)}
						focusRequestToken={groupIndex === focusGroupIndex ? focusNewRowToken : undefined}
					/>
					<button class="pos-manage-goal-new-btn" onclick={() => createProject(group.goal?.path)}>
						{t("manage.nav.newProjectInGoal")}
					</button>
				</div>
			{/if}
		</section>
	{/each}
{/if}
