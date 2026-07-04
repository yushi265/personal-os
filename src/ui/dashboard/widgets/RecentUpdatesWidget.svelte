<script lang="ts">
	import type { Entity } from "../../../domain/entity";
	import { t } from "../../../i18n/ja";
	import WidgetHeader from "./WidgetHeader.svelte";

	let {
		entities,
		onOpen,
		onViewAll,
	}: {
		entities: Entity[];
		onOpen: (path: string) => void;
		onViewAll?: () => void;
	} = $props();
</script>

<section class="pos-widget">
	<WidgetHeader icon="🕒" title={t("dashboard.widget.recentUpdates")} count={entities.length} {onViewAll} />
	{#if entities.length === 0}
		<p class="pos-widget-empty pos-widget-empty-ok">✓ {t("dashboard.empty.recentUpdates")}</p>
	{:else}
		<ul class="pos-widget-list">
			{#each entities as entity (entity.path)}
				<li class="pos-widget-item">
					<span
						class="pos-widget-item-text"
						role="link"
						tabindex="0"
						onclick={() => onOpen(entity.path)}
						onkeydown={(e) => e.key === "Enter" && onOpen(entity.path)}
					>
						・{entity.title}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
