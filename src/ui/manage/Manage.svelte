<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import {
		buildManageRows,
		DEFAULT_ENTITY_SORT,
		DEFAULT_TODO_SORT,
		EMPTY_MANAGE_FILTER,
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

	// capabilityが後から無効化された場合、Todosタブを選択中なら他タブへ退避する(§5)
	$effect(() => {
		if (tab === "todo" && !plugin.capability.todoFeatures) tab = "project";
	});

	function changeTab(next: ManageTab): void {
		tab = next;
		filter = { ...EMPTY_MANAGE_FILTER };
		sort = next === "todo" ? { ...DEFAULT_TODO_SORT } : { ...DEFAULT_ENTITY_SORT };
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
	</div>

	{#if !plugin.capability.todoFeatures}
		<div class="pos-widget pos-widget-banner">
			<p>{t("manage.todoDisabledNotice")}</p>
		</div>
	{/if}

	<ManageFilterBar {plugin} {tab} {filter} onChange={changeFilter} />

	<ManageTable {tab} {rows} {sort} onSortChange={changeSort} onOpen={openPath} />
</div>
