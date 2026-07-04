<script lang="ts">
	import { Menu, Notice, Platform } from "obsidian";
	import { untrack } from "svelte";
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { SaveViewModal } from "../modals/SaveViewModal";
	import { EntitySwitcherModal } from "../modals/EntitySwitcherModal";
	import { triggerHoverPreview } from "../hoverPreview";
	import type { SavedView } from "../../settings/settings";
	import { isEditableTarget } from "./manageKeyboard";
	import { slideIn } from "./slideTransition";
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
		screenPath,
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

	// ドリルダウンのスライド方向(Phase U3)。stackを変更する各操作の呼び出し元で明示的にセットする
	// (stack.length差分から$effectで推測すると、DOM更新後に効くため1テンポ遅れて誤動作するため)
	let slideDirection = $state<"push" | "pop">("push");
	// {#key}の再生成トリガ。current自体の参照変化ではなく、画面の種類+pathでのみ切り替える
	// (project-detailのフィルタ変更等、同一フレーム内の状態更新ではアニメーションを再生しない)
	const screenKey = $derived(`${current.kind}:${screenPath(current) ?? "root"}`);

	// スティッキーヘッダー(Phase U3): header+breadcrumb(navWrapperEl)の高さを計測し、
	// --pos-manage-nav-h としてルート要素に反映する。フィルタバー1行目(toolbar-row)はさらにその下にスタックするため、
	// その高さを --pos-manage-toolbar-h として同様に反映する(styles.cssのcalc()で積み上げる)
	let manageRootEl: HTMLDivElement | undefined = $state();
	let navWrapperEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!navWrapperEl || !manageRootEl) return;
		const root = manageRootEl;
		const nav = navWrapperEl;
		const ro = new ResizeObserver(() => {
			root.style.setProperty("--pos-manage-nav-h", `${nav.offsetHeight}px`);
		});
		ro.observe(nav);
		return () => ro.disconnect();
	});

	$effect(() => {
		// current(画面切替)ごとに、その画面のtoolbar-rowを再取得して計測し直す
		void current;
		if (!manageRootEl) return;
		const root = manageRootEl;
		const toolbarRow = root.querySelector<HTMLElement>(".pos-manage-toolbar-row");
		if (!toolbarRow) {
			root.style.setProperty("--pos-manage-toolbar-h", "0px");
			return;
		}
		const ro = new ResizeObserver(() => {
			root.style.setProperty("--pos-manage-toolbar-h", `${toolbarRow.offsetHeight}px`);
		});
		ro.observe(toolbarRow);
		return () => ro.disconnect();
	});

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
			path: screenPath(screen),
			onClick: () => {
				slideDirection = "pop";
				stack = popTo(stack, i);
			},
		}))
	);

	function breadcrumbLabel(screen: ManageScreen): string {
		if (screen.kind === "project-list") return t("manage.title");
		return plugin.store.get(screen.path)?.title ?? t("manage.nav.unknown");
	}

	function onBreadcrumbHover(e: MouseEvent, path: string | undefined): void {
		if (!path) return;
		triggerHoverPreview(plugin.app, e, e.currentTarget as HTMLElement, path);
	}

	function goBack(): void {
		slideDirection = "pop";
		stack = popOne(stack);
	}

	function goToProjectDetail(path: string): void {
		slideDirection = "push";
		stack = pushScreen(stack, makeProjectDetailScreen(path));
	}

	function goToTicketDetail(path: string): void {
		slideDirection = "push";
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
			if (result.truncated) {
				slideDirection = "pop";
				stack = result.stack;
				new Notice(t("manage.nav.entityGone"));
			} else {
				stack = result.stack;
			}
		});
	});

	// Dashboard等の外部からのナビゲーション要求。現在の深いスタックは保持せず [project-list, screen] にリセットする(§2.5)
	$effect(() => {
		const req = $navigateRequest;
		if (!req) return;
		untrack(() => {
			slideDirection = "push";
			stack = [{ kind: "project-list" }, req.screen];
		});
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -- ページ内ショートカット(n/Backspace)束ね用のコンテナ。詳細はhandleRootKeydown参照 -->
<div class="pos-manage" bind:this={manageRootEl} onkeydown={handleRootKeydown}>
	<div class="pos-manage-sticky-nav" bind:this={navWrapperEl}>
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
				<!-- svelte-ignore a11y_mouse_events_have_key_events -- ホバープレビュー(Phase U3)はマウス専用のプログレッシブエンハンスメント。パンくずの主機能(遷移)はonclickのボタンで別途担保済み -->
				<button
					class="pos-manage-breadcrumb-item"
					class:pos-manage-breadcrumb-current={i === stack.length - 1}
					onclick={bc.onClick}
					onmouseover={(e) => onBreadcrumbHover(e, bc.path)}
				>
					{bc.label}
				</button>
				{#if i < breadcrumbs.length - 1}<span class="pos-manage-breadcrumb-sep">▸</span>{/if}
			{/each}
		</nav>
	</div>

	<div class="pos-manage-screen-viewport">
	{#key screenKey}
	<div class="pos-manage-screen" in:slideIn={{ direction: slideDirection }}>
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
	</div>
	{/key}
	</div>

	{#if !Platform.isMobile}
		<p class="pos-manage-kbd-hint">{t("manage.kbdHint")}</p>
	{/if}
</div>
