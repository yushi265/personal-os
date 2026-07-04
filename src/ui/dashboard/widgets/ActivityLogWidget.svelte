<script lang="ts">
	import { t } from "../../../i18n/ja";

	let { lines }: { lines: string[] } = $props();
</script>

<section class="pos-widget">
	<h3 class="pos-widget-title">{t("dashboard.widget.activityLog")}</h3>
	{#if lines.length === 0}
		<p class="pos-widget-empty">{t("dashboard.empty.activityLog")}</p>
	{:else}
		<ul class="pos-widget-list">
			{#each lines as line, i (i)}
				<li class="pos-widget-item pos-widget-log-line">{line}</li>
			{/each}
		</ul>
	{/if}
</section>
