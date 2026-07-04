<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { statusColorClass } from "../components/badgeStyles";
	import { makeProjectDetailScreen, makeTicketDetailScreen, resolveNavigateAction } from "../manage/manageNav";
	import type { TimelineData } from "./timelineData";

	let {
		plugin,
		data,
		onRefresh,
	}: {
		plugin: PersonalOSPlugin;
		data: Writable<TimelineData>;
		onRefresh: () => void;
	} = $props();

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	/** Timeline行はProject/Ticketのみのため、修飾クリック時以外は必ず管理View詳細へ遷移する(design-drilldown-nav.md §4.1と同じ操作言語) */
	function navigate(path: string, modifierClick: boolean): void {
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

	function barTitle(row: TimelineData["rows"][number]): string {
		if (row.isPoint) return `${row.title}\n${row.due}`;
		return `${row.title}\n${row.start ?? row.due} → ${row.due ?? row.start}`;
	}
</script>

<div class="pos-timeline">
	<div class="pos-timeline-header">
		<h2 class="pos-timeline-title">{t("timeline.title")}</h2>
		<button class="pos-dashboard-refresh" onclick={onRefresh} aria-label={t("dashboard.refresh")}>
			{t("dashboard.refresh")}
		</button>
	</div>

	{#if $data.rows.length === 0}
		<div class="pos-manage-empty-state">
			<span class="pos-manage-empty-icon" aria-hidden="true">📅</span>
			<p class="pos-manage-empty">{t("timeline.empty")}</p>
		</div>
	{:else}
		<div class="pos-timeline-range">{$data.rangeStart} — {$data.rangeEnd}</div>
		<div class="pos-timeline-rows">
			<div class="pos-timeline-grid">
				{#each $data.monthMarkers as marker (marker.pct + marker.label)}
					<div class="pos-timeline-month-line" style={`left: ${marker.pct}%`}>
						<span class="pos-timeline-month-label">{marker.label}</span>
					</div>
				{/each}
				{#if $data.todayPct !== null}
					<div class="pos-timeline-today-line" style={`left: ${$data.todayPct}%`}>
						<span class="pos-timeline-today-label">{t("timeline.today")}</span>
					</div>
				{/if}
			</div>
			{#each $data.rows as row (row.path)}
				<div class="pos-timeline-row">
					<span
						class="pos-timeline-row-label"
						role="link"
						tabindex="0"
						onclick={(e) => navigate(row.path, e.metaKey || e.ctrlKey)}
						onkeydown={(e) => e.key === "Enter" && navigate(row.path, e.metaKey || e.ctrlKey)}
					>
						{row.title}
					</span>
					<div class="pos-timeline-track">
						{#if row.isPoint}
							<div
								class="pos-timeline-point {statusColorClass(row.status)}"
								style={`left: ${row.leftPct}%`}
								title={barTitle(row)}
							></div>
						{:else}
							<div
								class="pos-timeline-bar {statusColorClass(row.status)}"
								style={`left: ${row.leftPct}%; width: ${row.widthPct}%`}
								title={barTitle(row)}
							></div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
