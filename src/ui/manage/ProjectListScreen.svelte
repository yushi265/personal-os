<script lang="ts">
	import { Notice } from "obsidian";
	import type { Snippet } from "svelte";
	import type PersonalOSPlugin from "../../main";
	import { entityCreatedNotice, t } from "../../i18n/ja";
	import { CreateEntityModal } from "../modals/CreateEntityModal";
	import ManageFilterBar from "./ManageFilterBar.svelte";
	import ManageTable from "./ManageTable.svelte";
	import InlineCreateRow from "./InlineCreateRow.svelte";
	import { buildManageRows, isManageVaultEmpty, type ManageFilter, type ManageSort, type ManageSortKey } from "./manageData";

	/**
	 * プロジェクト一覧画面(design-remove-goal.md G2): Goal概念廃止に伴い、Goalごとのグルーピング表示をやめ、
	 * フラットな単一テーブル(フィルタ+ソート、手動並び替えはentity.orderで維持)にする。
	 */
	let {
		plugin,
		refreshTick,
		filter,
		sort,
		filterExpanded,
		onFilterChange,
		onFilterExpandedChange,
		onSortChange,
		onNavigate,
		toolbarExtra,
		focusNewRowToken,
	}: {
		plugin: PersonalOSPlugin;
		refreshTick: number;
		filter: ManageFilter;
		sort: ManageSort;
		filterExpanded: boolean;
		onFilterChange: (next: ManageFilter) => void;
		onFilterExpandedChange: (next: boolean) => void;
		onSortChange: (key: ManageSortKey) => void;
		onNavigate: (path: string) => void;
		toolbarExtra?: Snippet;
		/** Manage.svelteの「n」キー操作からインライン新規作成行へフォーカスを要求する外部トリガー(Phase U2) */
		focusNewRowToken?: number;
	} = $props();

	// IndexStoreは素のMapでリアクティブでないため、refreshTickを明示的に参照して再計算のトリガとする(Manage.svelte参照)
	const rows = $derived.by(() => {
		void refreshTick;
		return buildManageRows(plugin, "project", filter, sort);
	});

	// オンボーディング判定(Phase U3): Vault内にProjectが1件も無い初回起動状態かどうか。フィルタ結果とは独立に判定する
	const isVaultEmpty = $derived.by(() => {
		void refreshTick;
		return isManageVaultEmpty(plugin.store);
	});

	function openNote(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	function createProject(): void {
		new CreateEntityModal(plugin.app, {
			entityService: plugin.entityService,
			store: plugin.store,
			settings: plugin.settings,
			initialType: "project",
			openAfterCreate: false,
		}).open();
	}

	// インライン新規作成(design-ui-first.md §4.2、Phase U2): status=backlog等の他フィールドはEntityService.createのデフォルトに委ねる
	async function createProjectInline(title: string): Promise<void> {
		await plugin.entityService.create({ type: "project", title });
		new Notice(entityCreatedNotice(title));
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
		</ol>
		<button type="button" class="pos-manage-onboarding-action" onclick={createProject}>
			{t("onboarding.welcome.createProject")}
		</button>
	</div>
{:else}
	<ManageTable
		tab="project"
		{rows}
		{sort}
		{plugin}
		{onSortChange}
		onOpen={openNote}
		{onNavigate}
		showParentColumn={false}
	/>
	<div class="pos-manage-create-row">
		<InlineCreateRow
			label={t("manage.nav.inlineNewProject")}
			inputPlaceholder={t("modal.createEntity.titleFieldPlaceholder")}
			onSubmit={createProjectInline}
			focusRequestToken={focusNewRowToken}
		/>
		<button class="pos-manage-new-btn" onclick={createProject}>
			{t("manage.nav.newProjectDetail")}
		</button>
	</div>
{/if}
