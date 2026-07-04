<script lang="ts">
	import type { Entity, EntityType } from "../../../domain/entity";
	import type PersonalOSPlugin from "../../../main";
	import { t } from "../../../i18n/ja";
	import { entityProgressFraction } from "../../manage/manageData";
	import { statusLabelFor } from "../dashboardData";
	import StatusBadge from "../../components/StatusBadge.svelte";
	import PriorityLabel from "../../components/PriorityLabel.svelte";
	import DueLabel from "../../components/DueLabel.svelte";
	import ProgressIndicator from "../../components/ProgressIndicator.svelte";
	import WidgetHeader from "./WidgetHeader.svelte";

	let {
		plugin,
		type,
		entities,
		onNavigate,
		onOpenNote,
		onViewAll,
	}: {
		plugin: PersonalOSPlugin;
		type: EntityType;
		entities: Entity[];
		onNavigate: (path: string, event: MouseEvent | KeyboardEvent) => void;
		onOpenNote: (path: string) => void;
		onViewAll?: () => void;
	} = $props();

	const titleKey = {
		goal: "dashboard.widget.activeGoals",
		project: "dashboard.widget.activeProjects",
		ticket: "dashboard.widget.activeTickets",
	} as const;

	const icon = { goal: "🎯", project: "📁", ticket: "🎫" } as const;
</script>

<section class="pos-widget">
	<WidgetHeader
		icon={icon[type as "goal" | "project" | "ticket"]}
		title={t(titleKey[type as "goal" | "project" | "ticket"])}
		count={entities.length}
		{onViewAll}
	/>
	{#if entities.length === 0}
		<p class="pos-widget-empty pos-widget-empty-ok">✓ {t("dashboard.empty.active")}</p>
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
						<StatusBadge value={entity.status} label={statusLabelFor(plugin, entity)} />
						<PriorityLabel value={entity.priority ?? ""} label={entity.priority ?? ""} />
						<DueLabel value={entity.due} />
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
						{@const fraction = entityProgressFraction(plugin.store, entity)}
						<ProgressIndicator progress={entity.progress ?? 0} done={fraction.done} total={fraction.total} />
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
