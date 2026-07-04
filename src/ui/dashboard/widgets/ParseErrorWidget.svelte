<script lang="ts">
	import { t } from "../../../i18n/ja";
	import WidgetHeader from "./WidgetHeader.svelte";

	let {
		errors,
		onOpen,
	}: {
		errors: { path: string; reason: string }[];
		onOpen: (path: string) => void;
	} = $props();
</script>

<section class="pos-widget pos-widget-danger">
	<WidgetHeader icon="⚠️" title={t("dashboard.widget.parseError")} count={errors.length} />
	<ul class="pos-widget-list">
		{#each errors as err (err.path)}
			<li class="pos-widget-item pos-widget-item-column">
				<span
					class="pos-widget-item-text"
					role="link"
					tabindex="0"
					onclick={() => onOpen(err.path)}
					onkeydown={(e) => e.key === "Enter" && onOpen(err.path)}
				>
					{err.path}
				</span>
				<span class="pos-widget-due">{err.reason}</span>
			</li>
		{/each}
	</ul>
</section>
