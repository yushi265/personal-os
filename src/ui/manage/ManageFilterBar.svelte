<script lang="ts">
	import type { Snippet } from "svelte";
	import { PRIORITIES, PROJECT_STATUSES, TICKET_STATUSES } from "../../domain/entity";
	import type { Period } from "../../domain/query";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { collectKnownLabels, collectKnownTags, EMPTY_MANAGE_FILTER, type ManageFilter, type ManageTab } from "./manageData";

	/**
	 * フィルタバー(常時1行のツールバー + 開閉式の詳細パネル + アクティブフィルタ要約チップ)。
	 * expanded(詳細パネルの開閉状態)は呼び出し元が保持する(project-listはlistFilterExpanded、
	 * project-detailのticket一覧はscreen.ticketFilterExpanded — いずれもフィルタ自体と同じ寿命)。
	 */
	let {
		plugin,
		tab,
		filter,
		onChange,
		expanded,
		onExpandedChange,
		showParentFilter = true,
		toolbarExtra,
	}: {
		plugin: PersonalOSPlugin;
		tab: ManageTab;
		filter: ManageFilter;
		onChange: (next: ManageFilter) => void;
		expanded: boolean;
		onExpandedChange: (next: boolean) => void;
		showParentFilter?: boolean;
		toolbarExtra?: Snippet;
	} = $props();

	const statusOptions = $derived(tab === "project" ? PROJECT_STATUSES : TICKET_STATUSES);
	const parentOptions = $derived(tab === "project" ? plugin.store.listByType("goal") : plugin.store.listByType("project"));
	const parentLabel = $derived(tab === "project" ? t("manage.filter.parentGoal") : t("manage.filter.parentProject"));
	const tagOptions = $derived(collectKnownTags(plugin.store));
	const labelOptions = $derived(collectKnownLabels(plugin.store));

	const periodLabels: Record<Period, string> = {
		today: t("manage.filter.period.today"),
		week: t("manage.filter.period.week"),
		overdue: t("manage.filter.period.overdue"),
		none: t("manage.filter.period.none"),
	};

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	function update(patch: Partial<ManageFilter>): void {
		onChange({ ...filter, ...patch });
	}

	function clear(): void {
		onChange({ ...EMPTY_MANAGE_FILTER });
	}

	// 詳細パネルを畳んでいても効いているとわかるよう、トグルボタンのバッジ件数に使う(発見可能性)
	const activeCount = $derived(
		(filter.statuses.length > 0 ? 1 : 0) +
			(filter.priorities.length > 0 ? 1 : 0) +
			(filter.parentPath ? 1 : 0) +
			(filter.period ? 1 : 0) +
			(filter.tags.length > 0 ? 1 : 0) +
			(filter.labels.length > 0 ? 1 : 0) +
			(filter.showArchived ? 1 : 0)
	);

	interface SummaryChip {
		id: string;
		label: string;
		onRemove: () => void;
	}

	const summaryChips = $derived.by((): SummaryChip[] => {
		const chips: SummaryChip[] = [];
		for (const status of filter.statuses) {
			chips.push({
				id: `status:${status}`,
				label: `${t("manage.filter.status")}: ${status}`,
				onRemove: () => update({ statuses: filter.statuses.filter((v) => v !== status) }),
			});
		}
		for (const priority of filter.priorities) {
			chips.push({
				id: `priority:${priority}`,
				label: `${t("manage.filter.priority")}: ${priority}`,
				onRemove: () => update({ priorities: filter.priorities.filter((v) => v !== priority) }),
			});
		}
		if (filter.parentPath) {
			const parentTitle = parentOptions.find((p) => p.path === filter.parentPath)?.title ?? filter.parentPath;
			chips.push({ id: "parent", label: `${parentLabel}: ${parentTitle}`, onRemove: () => update({ parentPath: undefined }) });
		}
		if (filter.period) {
			chips.push({
				id: "period",
				label: `${t("manage.filter.period")}: ${periodLabels[filter.period]}`,
				onRemove: () => update({ period: undefined }),
			});
		}
		for (const tag of filter.tags) {
			chips.push({
				id: `tag:${tag}`,
				label: `${t("manage.filter.tags")}: ${tag}`,
				onRemove: () => update({ tags: filter.tags.filter((v) => v !== tag) }),
			});
		}
		for (const label of filter.labels) {
			chips.push({
				id: `label:${label}`,
				label: `${t("manage.filter.labels")}: ${label}`,
				onRemove: () => update({ labels: filter.labels.filter((v) => v !== label) }),
			});
		}
		if (filter.showArchived) {
			chips.push({ id: "archived", label: t("manage.filter.showArchived"), onRemove: () => update({ showArchived: false }) });
		}
		return chips;
	});
</script>

<div class="pos-manage-filterbar">
	<div class="pos-manage-toolbar-row">
		<input
			class="pos-manage-filter-keyword"
			type="text"
			placeholder={t("manage.filter.keyword")}
			value={filter.keyword}
			oninput={(e) => update({ keyword: (e.target as HTMLInputElement).value })}
		/>

		<button
			type="button"
			class="pos-manage-filter-toggle-btn"
			class:pos-manage-filter-toggle-active={activeCount > 0}
			aria-expanded={expanded}
			aria-label={t("manage.filter.toggleAria")}
			onclick={() => onExpandedChange(!expanded)}
		>
			{t("manage.filter.toggle")}{activeCount > 0 ? ` (${activeCount})` : ""}
			<span class="pos-manage-filter-toggle-caret">{expanded ? "▴" : "▾"}</span>
		</button>

		{#if toolbarExtra}
			{@render toolbarExtra()}
		{/if}
	</div>

	{#if summaryChips.length > 0}
		<div class="pos-manage-filter-summary" role="group" aria-label={t("manage.filter.toggle")}>
			{#each summaryChips as chip (chip.id)}
				<button type="button" class="pos-manage-summary-chip" onclick={chip.onRemove} aria-label={`${chip.label}${t("manage.filter.removeSuffix")}`}>
					{chip.label} <span aria-hidden="true">×</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if expanded}
		<div class="pos-manage-filter-panel">
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
	{/if}
</div>
