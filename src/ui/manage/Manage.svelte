<script lang="ts">
	import { Menu, Notice, Platform } from "obsidian";
	import { untrack } from "svelte";
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { SaveViewModal } from "../modals/SaveViewModal";
	import { EntitySwitcherModal } from "../modals/EntitySwitcherModal";
	import type { SavedView } from "../../settings/settings";
	import { isEditableTarget } from "./manageKeyboard";
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
		isManageSavedViewVisible,
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
	import TicketDetailScreen from "./TicketDetailScreen.svelte";

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
	let listFilterExpanded = $state(false);
	let collapsedGoals = $state<Set<string>>(new Set());

	// キーボード操作(Phase U2): 「n」でインライン新規作成行へフォーカスを要求する外部トリガー
	let focusNewRowToken = $state(0);

	const manageSavedViews = $derived.by((): SavedView[] => {
		void $refreshToken;
		return plugin.savedViewService.list().filter(isManageSavedViewVisible);
	});

	// IndexStoreは素のMapでリアクティブでないため、各ドリルダウン画面のIndexStore読み出し系$derivedは
	// このrefreshTickを明示的に参照して再計算のトリガとする(design-drilldown-nav.md、manageSavedViewsと同じパターン)
	const refreshTick = $derived($refreshToken.token);

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
		const view = manageSavedViews.find((v) => v.id === id);
		if (!view) return;
		listFilter = queryStringToFilter(view.query);
		listSort = view.sort;
	}

	async function saveCurrentView(name: string): Promise<void> {
		await plugin.savedViewService.save({
			name: name || t("manage.savedView.unnamed"),
			query: filterToQueryString(listFilter, "project"),
			sort: listSort,
			viewMode: "manage",
		});
	}

	function openSaveViewModal(): void {
		new SaveViewModal(plugin.app, { onSubmit: saveCurrentView }).open();
	}

	function openEntitySwitcher(): void {
		new EntitySwitcherModal(plugin.app, {
			store: plugin.store,
			onChooseProject: goToProjectDetail,
			onChooseTicket: goToTicketDetail,
			onChooseGoal: openPath,
		}).open();
	}

	/**
	 * 管理View内キーボード操作(Phase U2): 「n」でインライン新規作成行へフォーカス、
	 * Backspace/Alt+←でパンくずを一つ戻る。入力欄・編集中セルにフォーカスがある間は発動しない。
	 * contentEl(このView)配下でのみ有効なため、Obsidianのグローバルショートカットとは衝突しない。
	 */
	function handleRootKeydown(e: KeyboardEvent): void {
		if (isEditableTarget(e.target as HTMLElement | null)) return;
		if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			focusNewRowToken++;
			return;
		}
		if (e.key === "Backspace" || (e.key === "ArrowLeft" && e.altKey)) {
			if (stack.length <= 1) return;
			e.preventDefault();
			goBack();
		}
	}

	function openSavedViewMenu(e: MouseEvent): void {
		const menu = new Menu();
		if (manageSavedViews.length === 0) {
			menu.addItem((item) => item.setTitle(t("manage.savedView.empty")).setDisabled(true));
		} else {
			for (const view of manageSavedViews) {
				menu.addItem((item) => item.setTitle(view.name).onClick(() => applySavedView(view.id)));
			}
		}
		menu.addSeparator();
		menu.addItem((item) => item.setTitle(t("manage.savedView.saveNew")).onClick(openSaveViewModal));
		menu.showAtMouseEvent(e);
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

<!-- svelte-ignore a11y_no_static_element_interactions -- ページ内ショートカット(n/Backspace)束ね用のコンテナ。詳細はhandleRootKeydown参照 -->
<div class="pos-manage" onkeydown={handleRootKeydown}>
	<div class="pos-manage-header">
		<h2 class="pos-manage-title">{t("manage.title")}</h2>
		<button
			type="button"
			class="pos-manage-entity-switcher-btn"
			aria-label={t("manage.toolbar.entitySwitcher")}
			title={t("manage.toolbar.entitySwitcher")}
			onclick={openEntitySwitcher}
		>
			🔍
		</button>
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
		<ProjectListScreen
			{plugin}
			{refreshTick}
			filter={listFilter}
			sort={listSort}
			{collapsedGoals}
			filterExpanded={listFilterExpanded}
			onFilterChange={changeListFilter}
			onFilterExpandedChange={(next) => (listFilterExpanded = next)}
			onSortChange={changeListSort}
			onToggleGoal={toggleGoal}
			onNavigate={goToProjectDetail}
			{focusNewRowToken}
		>
			{#snippet toolbarExtra()}
				<button type="button" class="pos-manage-savedview-btn" onclick={openSavedViewMenu}>
					{t("manage.savedView.menuButton")}
				</button>
			{/snippet}
		</ProjectListScreen>
	{:else if current.kind === "project-detail"}
		<ProjectDetailScreen
			{plugin}
			{refreshTick}
			screen={current}
			onScreenChange={updateCurrentScreen}
			onNavigateTicket={goToTicketDetail}
			onOpenNote={openPath}
			{focusNewRowToken}
		/>
	{:else if current.kind === "ticket-detail"}
		<TicketDetailScreen {plugin} {refreshTick} screen={current} onScreenChange={updateCurrentScreen} onOpenNote={openPath} />
	{/if}

	{#if !Platform.isMobile}
		<p class="pos-manage-kbd-hint">{t("manage.kbdHint")}</p>
	{/if}
</div>
