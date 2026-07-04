<script lang="ts">
	import type { Entity, EntityType } from "../../../domain/entity";
	import { t } from "../../../i18n/ja";

	let {
		type,
		entities,
		onNavigate,
		onOpenNote,
	}: {
		type: EntityType;
		entities: Entity[];
		onNavigate: (path: string, event: MouseEvent | KeyboardEvent) => void;
		onOpenNote: (path: string) => void;
	} = $props();

	const titleKey = {
		goal: "dashboard.widget.activeGoals",
		project: "dashboard.widget.activeProjects",
		ticket: "dashboard.widget.activeTickets",
	} as const;
</script>

<section class="pos-widget">
	<h3 class="pos-widget-title">{t(titleKey[type as "goal" | "project" | "ticket"])}</h3>
	{#if entities.length === 0}
		<p class="pos-widget-empty">{t("dashboard.empty.active")}</p>
	{:else}
		<ul class="pos-widget-list">
			{#each entities as entity (entity.path)}
				<li class="pos-widget-item pos-widget-item-column">
					<div class="pos-widget-item-row">
						<span
							class="pos-widget-item-text"
							role="link"
							tabindex="0"
							onclick={(e) => onNavigate(entity.path, e)}
							onkeydown={(e) => e.key === "Enter" && onNavigate(entity.path, e)}
						>
							▸ {entity.title}
						</span>
						{#if type !== "goal"}
							<button
								class="pos-widget-open-note"
								onclick={(e) => {
									e.stopPropagation();
									onOpenNote(entity.path);
								}}
								aria-label={t("dashboard.openNote")}
							>
								↗
							</button>
						{/if}
					</div>
					{#if type !== "goal"}
						<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
							<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
						</div>
						<span class="pos-progress-label">{entity.progress ?? 0}%</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
