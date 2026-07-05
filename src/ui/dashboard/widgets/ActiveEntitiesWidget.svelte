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
		onViewAll,
	}: {
		plugin: PersonalOSPlugin;
		type: Extract<EntityType, "project" | "ticket">;
		entities: Entity[];
		onNavigate: (path: string, event: MouseEvent | KeyboardEvent) => void;
		onViewAll?: () => void;
	} = $props();

	const titleKey = {
		project: "dashboard.widget.activeProjects",
		ticket: "dashboard.widget.activeTickets",
	} as const;

	const icon = { project: "📁", ticket: "🎫" } as const;
</script>

<section class="pos-widget">
	<WidgetHeader icon={icon[type]} title={t(titleKey[type])} count={entities.length} {onViewAll} />
	{#if entities.length === 0}
		<p class="pos-widget-empty pos-widget-empty-ok">✓ {t("dashboard.empty.active")}</p>
	{:else}
		<ul class="pos-widget-list">
			{#each entities as entity (entity.path)}
				{@const fraction = entityProgressFraction(plugin.store, entity)}
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
					</div>
					<ProgressIndicator progress={entity.progress ?? 0} done={fraction.done} total={fraction.total} />
				</li>
			{/each}
		</ul>
	{/if}
</section>
