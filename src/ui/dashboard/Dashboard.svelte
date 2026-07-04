<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import type { Todo } from "../../domain/todo";
	import { t } from "../../i18n/ja";
	import type { DashboardData } from "./dashboardData";
	import TodayTodoWidget from "./widgets/TodayTodoWidget.svelte";
	import OverdueWidget from "./widgets/OverdueWidget.svelte";
	import ActiveEntitiesWidget from "./widgets/ActiveEntitiesWidget.svelte";
	import ReviewNeededWidget from "./widgets/ReviewNeededWidget.svelte";
	import BlockedWidget from "./widgets/BlockedWidget.svelte";
	import RecentUpdatesWidget from "./widgets/RecentUpdatesWidget.svelte";
	import ActivityLogWidget from "./widgets/ActivityLogWidget.svelte";
	import ParseErrorWidget from "./widgets/ParseErrorWidget.svelte";

	let {
		plugin,
		data,
		onRefresh,
	}: {
		plugin: PersonalOSPlugin;
		data: Writable<DashboardData>;
		onRefresh: () => void;
	} = $props();

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	function toggleTodo(todo: Todo): void {
		void plugin.todoService.toggle(todo);
	}
</script>

<div class="pos-dashboard">
	<div class="pos-dashboard-header">
		<h2 class="pos-dashboard-title">{t("dashboard.title")}</h2>
		<button class="pos-dashboard-refresh" onclick={onRefresh} aria-label={t("dashboard.refresh")}>
			{t("dashboard.refresh")}
		</button>
	</div>

	<div class="pos-dashboard-grid">
		{#each plugin.settings.dashboard.widgets.filter((w) => w.visible) as w (w.id)}
			{#if w.id === "today-todo" && $data.todoFeatures}
				<TodayTodoWidget todos={$data.todayTodos} onToggle={toggleTodo} onOpen={openPath} />
			{:else if w.id === "overdue" && $data.todoFeatures}
				<OverdueWidget todos={$data.overdueTodos} entities={$data.overdueEntities} onToggle={toggleTodo} onOpen={openPath} />
			{:else if w.id === "active-goals"}
				<ActiveEntitiesWidget type="goal" entities={$data.activeGoals} onOpen={openPath} />
			{:else if w.id === "active-projects"}
				<ActiveEntitiesWidget type="project" entities={$data.activeProjects} onOpen={openPath} />
			{:else if w.id === "active-tickets"}
				<ActiveEntitiesWidget type="ticket" entities={$data.activeTickets} onOpen={openPath} />
			{:else if w.id === "review-needed"}
				<ReviewNeededWidget entities={$data.reviewNeeded} onOpen={openPath} />
			{:else if w.id === "blocked"}
				<BlockedWidget entities={$data.blocked} onOpen={openPath} />
			{:else if w.id === "recent-updates"}
				<RecentUpdatesWidget entities={$data.recentUpdates} onOpen={openPath} />
			{:else if w.id === "activity-log"}
				<ActivityLogWidget lines={$data.activityLogLines} />
			{:else if w.id === "parse-error" && $data.parseErrors.length > 0}
				<ParseErrorWidget errors={$data.parseErrors} onOpen={openPath} />
			{/if}
		{/each}
	</div>
</div>
