<script lang="ts">
	import { t } from "../../../i18n/ja";

	/**
	 * Dashboard Widget共通ヘッダ(Phase V1: アイコン+タイトル+件数ピル+「すべて見る」リンク)。
	 * 「すべて見る」の遷移先はどのWidgetも管理View(project-list、全Entityの入口)へ揃える
	 * (Overdue/Blocked等の絞り込み専用画面は現状存在しないため)。
	 */
	let {
		icon,
		title,
		count,
		onViewAll,
	}: {
		icon: string;
		title: string;
		count?: number;
		onViewAll?: () => void;
	} = $props();
</script>

<div class="pos-widget-header">
	<h3 class="pos-widget-title">
		<span class="pos-widget-icon" aria-hidden="true">{icon}</span>
		{title}
		{#if count !== undefined}<span class="pos-widget-count-pill">{count}</span>{/if}
	</h3>
	{#if onViewAll}
		<button type="button" class="pos-widget-viewall" onclick={onViewAll}>{t("dashboard.viewAll")}</button>
	{/if}
</div>
