<script lang="ts">
	import { t } from "../../../i18n/ja";
	import WidgetHeader from "./WidgetHeader.svelte";

	let { lines, onViewAll }: { lines: string[]; onViewAll?: () => void } = $props();
</script>

<section class="pos-widget">
	<WidgetHeader icon="📜" title={t("dashboard.widget.activityLog")} {onViewAll} />
	{#if lines.length === 0}
		<p class="pos-widget-empty pos-widget-empty-ok">✓ {t("dashboard.empty.activityLog")}</p>
	{:else}
		<ul class="pos-widget-list">
			{#each lines as line, i (i)}
				<li class="pos-widget-item pos-widget-log-line">{line}</li>
			{/each}
		</ul>
	{/if}
</section>
