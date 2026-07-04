<script lang="ts">
	import { t } from "../../../i18n/ja";

	let {
		errors,
		onOpen,
	}: {
		errors: { path: string; reason: string }[];
		onOpen: (path: string) => void;
	} = $props();
</script>

<section class="pos-widget pos-widget-danger">
	<h3 class="pos-widget-title">{t("dashboard.widget.parseError")} ({errors.length})</h3>
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
