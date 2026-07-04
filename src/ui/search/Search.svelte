<script lang="ts">
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import type { Entity } from "../../domain/entity";
	import type { Todo } from "../../domain/todo";
	import type { SavedView } from "../../settings/settings";

	let { plugin }: { plugin: PersonalOSPlugin } = $props();

	let queryText = $state("");
	let sortKey = $state<SavedView["sort"]["key"]>("title");
	let sortOrder = $state<SavedView["sort"]["order"]>("asc");
	let selectedSavedViewId = $state("");
	let entityResults = $state<Entity[]>([]);
	let todoResults = $state<Todo[]>([]);
	let savedViews = $state<SavedView[]>([]);

	// ManageView専用のSavedView(viewMode==="manage")は一覧に出さない(design-ui-first.md §3.4)
	$effect(() => {
		savedViews = plugin.savedViewService.list().filter((v) => v.viewMode !== "manage");
	});

	function sortValue(e: Entity): string | number {
		switch (sortKey) {
			case "due":
				return e.due ?? "";
			case "priority":
				return e.priority ?? "";
			case "progress":
				return e.progress ?? 0;
			case "title":
			default:
				return e.title;
		}
	}

	function sortedEntities(list: Entity[]): Entity[] {
		return [...list].sort((a, b) => {
			const av = sortValue(a);
			const bv = sortValue(b);
			if (av === bv) return 0;
			const asc = av < bv ? -1 : 1;
			return sortOrder === "asc" ? asc : -asc;
		});
	}

	function runSearch(): void {
		entityResults = sortedEntities(plugin.searchService.searchEntities(queryText));
		todoResults = plugin.searchService.searchTodos(queryText);
	}

	function applySavedView(id: string): void {
		selectedSavedViewId = id;
		const view = savedViews.find((v) => v.id === id);
		if (!view) return;
		queryText = view.query;
		sortKey = view.sort.key;
		sortOrder = view.sort.order;
		runSearch();
	}

	async function saveCurrentQuery(): Promise<void> {
		const name = queryText.trim() || t("search.unnamedView");
		await plugin.savedViewService.save({
			name,
			query: queryText,
			sort: { key: sortKey, order: sortOrder },
			viewMode: "list",
		});
		savedViews = plugin.savedViewService.list().filter((v) => v.viewMode !== "manage");
	}

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	runSearch();
</script>

<div class="pos-search">
	<h2 class="pos-search-title">{t("search.title")}</h2>

	<div class="pos-search-controls">
		<select
			class="pos-search-saved-select"
			value={selectedSavedViewId}
			onchange={(e) => applySavedView((e.target as HTMLSelectElement).value)}
		>
			<option value="">{t("search.savedViewPlaceholder")}</option>
			{#each savedViews as view (view.id)}
				<option value={view.id}>{view.name}</option>
			{/each}
		</select>

		<input
			class="pos-search-input"
			type="text"
			placeholder={t("search.queryPlaceholder")}
			bind:value={queryText}
			onkeydown={(e) => e.key === "Enter" && runSearch()}
		/>

		<button onclick={runSearch}>{t("search.run")}</button>
		<button onclick={saveCurrentQuery}>{t("search.save")}</button>

		<select bind:value={sortKey} onchange={runSearch}>
			<option value="title">{t("search.sort.title")}</option>
			<option value="due">{t("search.sort.due")}</option>
			<option value="priority">{t("search.sort.priority")}</option>
			<option value="progress">{t("search.sort.progress")}</option>
		</select>
		<select bind:value={sortOrder} onchange={runSearch}>
			<option value="asc">{t("search.sort.asc")}</option>
			<option value="desc">{t("search.sort.desc")}</option>
		</select>
	</div>

	<section class="pos-widget">
		<h3 class="pos-widget-title">{t("search.entities")}</h3>
		{#if entityResults.length === 0}
			<p class="pos-widget-empty">{t("search.empty")}</p>
		{:else}
			<ul class="pos-widget-list">
				{#each entityResults as entity (entity.path)}
					<li class="pos-widget-item">
						<span
							class="pos-widget-item-text"
							role="link"
							tabindex="0"
							onclick={() => openPath(entity.path)}
							onkeydown={(e) => e.key === "Enter" && openPath(entity.path)}
						>
							{entity.title} ({entity.type}/{entity.status})
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="pos-widget">
		<h3 class="pos-widget-title">{t("search.todos")}</h3>
		{#if todoResults.length === 0}
			<p class="pos-widget-empty">{t("search.empty")}</p>
		{:else}
			<ul class="pos-widget-list">
				{#each todoResults as todo (`${todo.filePath}:${todo.line}`)}
					<li class="pos-widget-item">
						<span
							class="pos-widget-item-text"
							role="link"
							tabindex="0"
							onclick={() => openPath(todo.parentPath)}
							onkeydown={(e) => e.key === "Enter" && openPath(todo.parentPath)}
						>
							{todo.text}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
