<script lang="ts">
	import { Notice } from "obsidian";
	import { untrack } from "svelte";
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import type { SavedView } from "../../settings/settings";
	import {
		DEFAULT_ENTITY_SORT,
		EMPTY_MANAGE_FILTER,
		filterToQueryString,
		queryStringToFilter,
		type ManageFilter,
		type ManageSort,
		type ManageSortKey,
	} from "./manageData";
	import {
		makeProjectDetailScreen,
		makeTicketDetailScreen,
		popOne,
		popTo,
		pushScreen,
		reconcileStack,
		type ManageScreen,
	} from "./manageNav";
	import type { ManageRefreshToken } from "./ManageView";
	import ProjectListScreen from "./ProjectListScreen.svelte";
	import ProjectDetailScreen from "./ProjectDetailScreen.svelte";

	let {
		plugin,
		refreshToken,
		navigateRequest,
	}: {
		plugin: PersonalOSPlugin;
		refreshToken: Writable<ManageRefreshToken>;
		navigateRequest: Writable<{ token: number; screen: ManageScreen } | null>;
	} = $props();

	// 画面スタック。project-listは常にindex 0固定(design-drilldown-nav.md §2.1)
	let stack = $state<ManageScreen[]>([{ kind: "project-list" }]);
	const current = $derived(stack[stack.length - 1]);

	// プロジェクト一覧のフィルタ・ソート・折りたたみ状態はスタック外の永続state(§2.3)
	let listFilter = $state<ManageFilter>({ ...EMPTY_MANAGE_FILTER });
	let listSort = $state<ManageSort>({ ...DEFAULT_ENTITY_SORT });
	let collapsedGoals = $state<Set<string>>(new Set());

	let savedViewName = $state("");
	let selectedSavedViewId = $state("");

	const manageSavedViews = $derived.by((): SavedView[] => {
		void $refreshToken;
		return plugin.savedViewService.list().filter((v) => v.viewMode === "manage");
	});

	const breadcrumbs = $derived(
		stack.map((screen, i) => ({
			label: breadcrumbLabel(screen),
			onClick: () => (stack = popTo(stack, i)),
		}))
	);

	function breadcrumbLabel(screen: ManageScreen): string {
		if (screen.kind === "project-list") return t("manage.title");
		return plugin.store.get(screen.path)?.title ?? t("manage.nav.unknown");
	}

	function goBack(): void {
		stack = popOne(stack);
	}

	function goToProjectDetail(path: string): void {
		stack = pushScreen(stack, makeProjectDetailScreen(path));
	}

	function goToTicketDetail(path: string): void {
		stack = pushScreen(stack, makeTicketDetailScreen(path));
	}

	// project-detail/ticket-detailのフレーム固有state(§2.3)は、スタック末尾を丸ごと差し替える形で更新する
	function updateCurrentScreen(next: ManageScreen): void {
		stack = [...stack.slice(0, -1), next];
	}

	function toggleGoal(key: string): void {
		const next = new Set(collapsedGoals);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		collapsedGoals = next;
	}

	function changeListFilter(next: ManageFilter): void {
		listFilter = next;
	}

	function changeListSort(key: ManageSortKey): void {
		listSort = listSort.key === key ? { key, order: listSort.order === "asc" ? "desc" : "asc" } : { key, order: "asc" };
	}

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	function applySavedView(id: string): void {
		selectedSavedViewId = id;
		const view = manageSavedViews.find((v) => v.id === id);
		if (!view) return;
		listFilter = queryStringToFilter(view.query);
		listSort = view.sort;
	}

	async function saveCurrentView(): Promise<void> {
		const name = savedViewName.trim() || t("manage.savedView.unnamed");
		await plugin.savedViewService.save({
			name,
			query: filterToQueryString(listFilter, "project"),
			sort: listSort,
			viewMode: "manage",
		});
		savedViewName = "";
	}

	// index-updated由来の再描画契機ごとにrename追従+消滅検証を行う(§2.4)。
	// untrack()でstackの読み書きをこの effect の依存対象から外し、$refreshTokenの変化のみに反応させる
	// (そうしないとstack自身への代入が同じeffectを再度トリガし、無駄な再検証ループになるため)
	$effect(() => {
		const { renames } = $refreshToken;
		untrack(() => {
			const result = reconcileStack(stack, plugin.store, renames);
			stack = result.stack;
			if (result.truncated) new Notice(t("manage.nav.entityGone"));
		});
	});

	// Dashboard等の外部からのナビゲーション要求。現在の深いスタックは保持せず [project-list, screen] にリセットする(§2.5)
	$effect(() => {
		const req = $navigateRequest;
		if (!req) return;
		untrack(() => {
			stack = [{ kind: "project-list" }, req.screen];
		});
	});
</script>

<div class="pos-manage">
	<div class="pos-manage-header">
		<h2 class="pos-manage-title">{t("manage.title")}</h2>
	</div>

	<nav class="pos-manage-breadcrumb" aria-label="breadcrumb">
		{#if stack.length > 1}
			<button class="pos-manage-back-btn" onclick={goBack}>{t("manage.nav.back")}</button>
		{/if}
		{#each breadcrumbs as bc, i (i)}
			<button
				class="pos-manage-breadcrumb-item"
				class:pos-manage-breadcrumb-current={i === stack.length - 1}
				onclick={bc.onClick}
			>
				{bc.label}
			</button>
			{#if i < breadcrumbs.length - 1}<span class="pos-manage-breadcrumb-sep">▸</span>{/if}
		{/each}
	</nav>

	{#if current.kind === "project-list"}
		<div class="pos-manage-savedview">
			<select
				class="pos-manage-savedview-select"
				value={selectedSavedViewId}
				onchange={(e) => applySavedView((e.target as HTMLSelectElement).value)}
			>
				<option value="">{t("manage.savedView.placeholder")}</option>
				{#each manageSavedViews as view (view.id)}
					<option value={view.id}>{view.name}</option>
				{/each}
			</select>
			<input
				class="pos-manage-savedview-name"
				type="text"
				placeholder={t("manage.savedView.namePlaceholder")}
				bind:value={savedViewName}
			/>
			<button onclick={saveCurrentView}>{t("manage.savedView.save")}</button>
		</div>

		<ProjectListScreen
			{plugin}
			filter={listFilter}
			sort={listSort}
			{collapsedGoals}
			onFilterChange={changeListFilter}
			onSortChange={changeListSort}
			onToggleGoal={toggleGoal}
			onNavigate={goToProjectDetail}
		/>
	{:else if current.kind === "project-detail"}
		<ProjectDetailScreen
			{plugin}
			screen={current}
			onScreenChange={updateCurrentScreen}
			onNavigateTicket={goToTicketDetail}
			onOpenNote={openPath}
		/>
	{:else if current.kind === "ticket-detail"}
		{@const entity = plugin.store.get(current.path)}
		<div class="pos-manage-placeholder">
			<h3>{entity?.title ?? t("manage.nav.unknown")}</h3>
			<p>{t("manage.nav.placeholderNotice")}</p>
			<button onclick={() => openPath(current.path)}>{t("manage.nav.openNote")}</button>
		</div>
	{/if}
</div>
