<script lang="ts">
	import type { Entity } from "../../../domain/entity";
	import { t } from "../../../i18n/ja";

	let {
		entities,
		onOpen,
	}: {
		entities: Entity[];
		onOpen: (path: string) => void;
	} = $props();
</script>

<section class="pos-widget pos-widget-warn">
	<h3 class="pos-widget-title">{t("dashboard.widget.reviewNeeded")} 🟡</h3>
	{#if entities.length === 0}
		<p class="pos-widget-empty">{t("dashboard.empty.reviewNeeded")}</p>
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
						▸ {entity.title}
					</span>
					<span class="pos-widget-due">({entity.reviewCycle}, last: {entity.lastReviewed ?? "-"})</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
