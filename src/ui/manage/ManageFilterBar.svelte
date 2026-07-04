<script lang="ts">
	import { PRIORITIES, PROJECT_STATUSES, TICKET_STATUSES } from "../../domain/entity";
	import type { Period } from "../../domain/query";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { collectKnownLabels, collectKnownTags, EMPTY_MANAGE_FILTER, type ManageFilter, type ManageTab } from "./manageData";

	let {
		plugin,
		tab,
		filter,
		onChange,
		showParentFilter = true,
	}: {
		plugin: PersonalOSPlugin;
		tab: ManageTab;
		filter: ManageFilter;
		onChange: (next: ManageFilter) => void;
		showParentFilter?: boolean;
	} = $props();

	const statusOptions = $derived(tab === "project" ? PROJECT_STATUSES : TICKET_STATUSES);
	const parentOptions = $derived(tab === "project" ? plugin.store.listByType("goal") : plugin.store.listByType("project"));
	const parentLabel = $derived(tab === "project" ? t("manage.filter.parentGoal") : t("manage.filter.parentProject"));
	const tagOptions = $derived(collectKnownTags(plugin.store));
	const labelOptions = $derived(collectKnownLabels(plugin.store));

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	function update(patch: Partial<ManageFilter>): void {
		onChange({ ...filter, ...patch });
	}

	function clear(): void {
		onChange({ ...EMPTY_MANAGE_FILTER });
	}
</script>

<div class="pos-manage-filterbar">
	<input
		class="pos-manage-filter-keyword"
		type="text"
		placeholder={t("manage.filter.keyword")}
		value={filter.keyword}
		oninput={(e) => update({ keyword: (e.target as HTMLInputElement).value })}
	/>

	{#if statusOptions.length > 0}
		<div class="pos-manage-chip-group" role="group" aria-label={t("manage.filter.status")}>
			{#each statusOptions as status (status)}
				<button
					type="button"
					class="pos-manage-chip"
					class:pos-manage-chip-active={filter.statuses.includes(status)}
					onclick={() => update({ statuses: toggle(filter.statuses, status) })}
				>
					{status}
				</button>
			{/each}
		</div>
	{/if}

	<div class="pos-manage-chip-group" role="group" aria-label={t("manage.filter.priority")}>
		{#each PRIORITIES as priority (priority)}
			<button
				type="button"
				class="pos-manage-chip"
				class:pos-manage-chip-active={filter.priorities.includes(priority)}
				onclick={() => update({ priorities: toggle(filter.priorities, priority) })}
			>
				{priority}
			</button>
		{/each}
	</div>

	{#if showParentFilter && parentOptions.length > 0}
		<select
			class="pos-manage-filter-select"
			value={filter.parentPath ?? ""}
			onchange={(e) => update({ parentPath: (e.target as HTMLSelectElement).value || undefined })}
		>
			<option value="">{parentLabel}</option>
			{#each parentOptions as p (p.path)}
				<option value={p.path}>{p.title}</option>
			{/each}
		</select>
	{/if}

	<div class="pos-manage-chip-group" role="group" aria-label={t("manage.filter.period")}>
		<button type="button" class="pos-manage-chip" class:pos-manage-chip-active={!filter.period} onclick={() => update({ period: undefined })}>
			{t("manage.filter.period.any")}
		</button>
		<button
			type="button"
			class="pos-manage-chip"
			class:pos-manage-chip-active={filter.period === "today"}
			onclick={() => update({ period: "today" as Period })}
		>
			{t("manage.filter.period.today")}
		</button>
		<button
			type="button"
			class="pos-manage-chip"
			class:pos-manage-chip-active={filter.period === "week"}
			onclick={() => update({ period: "week" as Period })}
		>
			{t("manage.filter.period.week")}
		</button>
		<button
			type="button"
			class="pos-manage-chip"
			class:pos-manage-chip-active={filter.period === "overdue"}
			onclick={() => update({ period: "overdue" as Period })}
		>
			{t("manage.filter.period.overdue")}
		</button>
		<button
			type="button"
			class="pos-manage-chip"
			class:pos-manage-chip-active={filter.period === "none"}
			onclick={() => update({ period: "none" as Period })}
		>
			{t("manage.filter.period.none")}
		</button>
	</div>

	{#if tagOptions.length > 0}
		<div class="pos-manage-chip-group" role="group" aria-label={t("manage.filter.tags")}>
			{#each tagOptions as tag (tag)}
				<button
					type="button"
					class="pos-manage-chip"
					class:pos-manage-chip-active={filter.tags.includes(tag)}
					onclick={() => update({ tags: toggle(filter.tags, tag) })}
				>
					{tag}
				</button>
			{/each}
		</div>
	{/if}

	{#if labelOptions.length > 0}
		<div class="pos-manage-chip-group" role="group" aria-label={t("manage.filter.labels")}>
			{#each labelOptions as label (label)}
				<button
					type="button"
					class="pos-manage-chip"
					class:pos-manage-chip-active={filter.labels.includes(label)}
					onclick={() => update({ labels: toggle(filter.labels, label) })}
				>
					{label}
				</button>
			{/each}
		</div>
	{/if}

	<label class="pos-manage-filter-toggle">
		<input
			type="checkbox"
			checked={filter.showArchived}
			onchange={(e) => update({ showArchived: (e.target as HTMLInputElement).checked })}
		/>
		{t("manage.filter.showArchived")}
	</label>

	<button type="button" class="pos-manage-filter-clear" onclick={clear}>{t("manage.filter.clear")}</button>
</div>
