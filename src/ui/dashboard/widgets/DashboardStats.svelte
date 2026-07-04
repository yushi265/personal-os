<script lang="ts">
	import { t } from "../../../i18n/ja";

	/**
	 * Dashboard最上段のコンパクトな統計ライン(Phase V1)。クリックで管理Viewへ遷移する
	 * (絞り込み画面が無いため、統一して project-list を開く)。
	 */
	let {
		activeProjects,
		doingTickets,
		openTodos,
		overdue,
		onClick,
	}: {
		activeProjects: number;
		doingTickets: number;
		openTodos: number;
		overdue: number;
		onClick: () => void;
	} = $props();
</script>

<div class="pos-dashboard-stats">
	<button type="button" class="pos-stat-tile" onclick={onClick}>
		<span class="pos-stat-value">{activeProjects}</span>
		<span class="pos-stat-label">{t("dashboard.stat.activeProjects")}</span>
	</button>
	<button type="button" class="pos-stat-tile" onclick={onClick}>
		<span class="pos-stat-value">{doingTickets}</span>
		<span class="pos-stat-label">{t("dashboard.stat.doingTickets")}</span>
	</button>
	<button type="button" class="pos-stat-tile" onclick={onClick}>
		<span class="pos-stat-value">{openTodos}</span>
		<span class="pos-stat-label">{t("dashboard.stat.openTodos")}</span>
	</button>
	<button
		type="button"
		class="pos-stat-tile"
		class:pos-stat-tile-alert={overdue > 0}
		class:pos-stat-tile-ok={overdue === 0}
		onclick={onClick}
	>
		<span class="pos-stat-value">{overdue}</span>
		<span class="pos-stat-label">{t("dashboard.stat.overdue")}</span>
	</button>
</div>
