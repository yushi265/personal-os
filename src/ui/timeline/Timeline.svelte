<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
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
</script>

<div class="pos-timeline">
	<div class="pos-timeline-header">
		<h2 class="pos-timeline-title">{t("timeline.title")}</h2>
		<button class="pos-dashboard-refresh" onclick={onRefresh} aria-label={t("dashboard.refresh")}>
			{t("dashboard.refresh")}
		</button>
	</div>

	{#if $data.rows.length === 0}
		<p class="pos-widget-empty">{t("timeline.empty")}</p>
	{:else}
		<div class="pos-timeline-range">{$data.rangeStart} — {$data.rangeEnd}</div>
		<div class="pos-timeline-rows">
			{#each $data.rows as row (row.path)}
				<div class="pos-timeline-row">
					<span
						class="pos-timeline-row-label"
						role="link"
						tabindex="0"
						onclick={() => openPath(row.path)}
						onkeydown={(e) => e.key === "Enter" && openPath(row.path)}
					>
						{row.title}
					</span>
					<div class="pos-timeline-track">
						{#if row.isPoint}
							<div class="pos-timeline-point" style={`left: ${row.leftPct}%`}></div>
						{:else}
							<div class="pos-timeline-bar" style={`left: ${row.leftPct}%; width: ${row.widthPct}%`}></div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
