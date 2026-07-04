<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import type { SavedView } from "../../settings/settings";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import { QuickAddModal } from "../modals/QuickAddModal";
	import {
		buildManageRows,
		DEFAULT_ENTITY_SORT,
		DEFAULT_TODO_SORT,
		EMPTY_MANAGE_FILTER,
		filterToQueryString,
		queryStringToFilter,
		type ManageFilter,
		type ManageSort,
		type ManageSortKey,
		type ManageTab,
	} from "./manageData";
	import ManageFilterBar from "./ManageFilterBar.svelte";
	import ManageTable from "./ManageTable.svelte";

	let { plugin, refreshToken }: { plugin: PersonalOSPlugin; refreshToken: Writable<number> } = $props();

	let tab = $state<ManageTab>("project");
	let filter = $state<ManageFilter>({ ...EMPTY_MANAGE_FILTER });
	let sort = $state<ManageSort>({ ...DEFAULT_ENTITY_SORT });
	let savedViewName = $state("");
	let selectedSavedViewId = $state("");

	// capabilityが後から無効化された場合、Todosタブを選択中なら他タブへ退避する(§5)
	$effect(() => {
		if (tab === "todo" && !plugin.capability.todoFeatures) tab = "project";
	});

	// ManageView自身が保存したSavedView(viewMode==="manage")のみを選択肢に出す(§3.4)
	const manageSavedViews = $derived.by((): SavedView[] => {
		void $refreshToken;
		return plugin.savedViewService.list().filter((v) => v.viewMode === "manage");
	});

	function changeTab(next: ManageTab): void {
		tab = next;
		filter = { ...EMPTY_MANAGE_FILTER };
		sort = next === "todo" ? { ...DEFAULT_TODO_SORT } : { ...DEFAULT_ENTITY_SORT };
		selectedSavedViewId = "";
	}

	function changeFilter(next: ManageFilter): void {
		filter = next;
	}

	function changeSort(key: ManageSortKey): void {
		sort = sort.key === key ? { key, order: sort.order === "asc" ? "desc" : "asc" } : { key, order: "asc" };
	}

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	function applySavedView(id: string): void {
		selectedSavedViewId = id;
		const view = manageSavedViews.find((v) => v.id === id);
		if (!view) return;
		tab = view.tab ?? "project";
		filter = queryStringToFilter(view.query);
		sort = view.sort;
	}

	async function saveCurrentView(): Promise<void> {
		const name = savedViewName.trim() || t("manage.savedView.unnamed");
		await plugin.savedViewService.save({
			name,
			query: filterToQueryString(filter, tab),
			sort,
			viewMode: "manage",
			tab,
		});
		savedViewName = "";
	}

	function openNew(): void {
		if (tab === "todo") {
			new QuickAddModal(plugin.app, {
				todoService: plugin.todoService,
				store: plugin.store,
				settings: plugin.settings,
				todoFeatures: plugin.capability.todoFeatures,
			}).open();
			return;
		}
		new CreateEntityModal(plugin.app, {
			entityService: plugin.entityService,
			store: plugin.store,
			settings: plugin.settings,
			initialType: tab,
			initialParentPath: filter.parentPath,
		}).open();
	}

	// $refreshTokenを読むことで、index-updated等由来の再描画契機にも追従する(design-ui-first.md §6)
	const rows = $derived.by(() => {
		void $refreshToken;
		return buildManageRows(plugin, tab, filter, sort);
	});
</script>

<div class="pos-manage">
	<div class="pos-manage-header">
		<h2 class="pos-manage-title">{t("manage.title")}</h2>
		<div class="pos-manage-tabs">
			<button class="pos-manage-tab-btn" class:pos-manage-tab-active={tab === "project"} onclick={() => changeTab("project")}>
				{t("manage.tab.projects")}
			</button>
			<button class="pos-manage-tab-btn" class:pos-manage-tab-active={tab === "ticket"} onclick={() => changeTab("ticket")}>
				{t("manage.tab.tickets")}
			</button>
			{#if plugin.capability.todoFeatures}
				<button class="pos-manage-tab-btn" class:pos-manage-tab-active={tab === "todo"} onclick={() => changeTab("todo")}>
					{t("manage.tab.todos")}
				</button>
			{/if}
		</div>
		<button class="pos-manage-new-btn" onclick={openNew}>{t("manage.newButton")}</button>
	</div>

	{#if !plugin.capability.todoFeatures}
		<div class="pos-widget pos-widget-banner">
			<p>{t("manage.todoDisabledNotice")}</p>
		</div>
	{/if}

	<ManageFilterBar {plugin} {tab} {filter} onChange={changeFilter} />

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

	<ManageTable {tab} {rows} {sort} {plugin} onSortChange={changeSort} onOpen={openPath} />
</div>
