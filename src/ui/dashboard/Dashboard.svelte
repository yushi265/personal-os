<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import type { Todo } from "../../domain/todo";
	import { t } from "../../i18n/ja";
	import { makeProjectDetailScreen, makeTicketDetailScreen, resolveNavigateAction } from "../manage/manageNav";
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

	/**
	 * ナビゲーション主動作(design-drilldown-nav.md §4.1)。
	 * project/ticketは対応する詳細画面へ、それ以外(goal/review/resource/inbox)または修飾クリック時はノートを開く。
	 */
	function navigateOrOpen(path: string, modifierClick: boolean): void {
		const entity = plugin.store.get(path);
		const action = resolveNavigateAction(entity?.type, modifierClick);
		if (action === "project-detail") {
			void plugin.openManageAt(makeProjectDetailScreen(path));
			return;
		}
		if (action === "ticket-detail") {
			void plugin.openManageAt(makeTicketDetailScreen(path));
			return;
		}
		openPath(path);
	}

	function handleNavigate(path: string, event: MouseEvent | KeyboardEvent): void {
		navigateOrOpen(path, event.metaKey || event.ctrlKey);
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

	{#if !$data.todoFeatures}
		<div class="pos-widget pos-widget-banner">
			<p>{t("dashboard.todoDisabledNotice")}</p>
			<p class="pos-widget-banner-links">
				<a href="https://obsidian.md/plugins?id=dataview" target="_blank" rel="noopener">Dataview</a>
				<a href="https://obsidian.md/plugins?id=obsidian-tasks-plugin" target="_blank" rel="noopener">Tasks</a>
			</p>
		</div>
	{/if}

	<div class="pos-dashboard-grid">
		{#each plugin.settings.dashboard.widgets.filter((w) => w.visible) as w (w.id)}
			{#if w.id === "today-todo" && $data.todoFeatures}
				<TodayTodoWidget todos={$data.todayTodos} onToggle={toggleTodo} onNavigate={handleNavigate} onOpenNote={openPath} />
			{:else if w.id === "overdue"}
				<OverdueWidget
					todos={$data.overdueTodos}
					entities={$data.overdueEntities}
					onToggle={toggleTodo}
					onNavigate={handleNavigate}
					onOpenNote={openPath}
				/>
			{:else if w.id === "active-goals"}
				<ActiveEntitiesWidget type="goal" entities={$data.activeGoals} onNavigate={handleNavigate} onOpenNote={openPath} />
			{:else if w.id === "active-projects"}
				<ActiveEntitiesWidget type="project" entities={$data.activeProjects} onNavigate={handleNavigate} onOpenNote={openPath} />
			{:else if w.id === "active-tickets"}
				<ActiveEntitiesWidget type="ticket" entities={$data.activeTickets} onNavigate={handleNavigate} onOpenNote={openPath} />
			{:else if w.id === "review-needed"}
				<ReviewNeededWidget entities={$data.reviewNeeded} onNavigate={handleNavigate} onOpenNote={openPath} />
			{:else if w.id === "blocked"}
				<BlockedWidget entities={$data.blocked} onNavigate={handleNavigate} onOpenNote={openPath} />
			{:else if w.id === "recent-updates"}
				<RecentUpdatesWidget entities={$data.recentUpdates} onOpen={(path) => navigateOrOpen(path, false)} />
			{:else if w.id === "activity-log"}
				<ActivityLogWidget lines={$data.activityLogLines} />
			{:else if w.id === "parse-error" && $data.parseErrors.length > 0}
				<ParseErrorWidget errors={$data.parseErrors} onOpen={openPath} />
			{/if}
		{/each}
	</div>
</div>
