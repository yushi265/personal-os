<script lang="ts">
	import { Notice } from "obsidian";
	import { t } from "../../i18n/ja";
	import { PRIORITY_ICON, priorityColorClass } from "./badgeStyles";

	/**
	 * priority(high/medium/low/未設定)のインライン編集セル(design-ui-first.md §3.1/§3.3)。
	 * optionsは呼び出し側(ManageRow/Preview)が「未設定」の選択肢も含めて渡す。
	 */
	let {
		value,
		options,
		onCommit,
	}: {
		value: string;
		options: { value: string; label: string }[];
		onCommit: (next: string) => Promise<void>;
	} = $props();

	let editing = $state(false);
	let optimistic = $state<{ v: string } | null>(null);
	const display = $derived(optimistic ? optimistic.v : value);

	$effect(() => {
		if (optimistic && value === optimistic.v) optimistic = null;
	});

	function currentLabel(): string {
		if (!display) return t("manage.field.unset");
		return options.find((o) => o.value === display)?.label ?? display;
	}

	// priority値ごとに矢印アイコン+色を出す(design-ui-first.md追補: UI磨き込み Phase N5)
	const icon = $derived(display ? (PRIORITY_ICON[display] ?? "") : "");
	const colorClass = $derived(priorityColorClass(display));

	async function commit(next: string): Promise<void> {
		optimistic = { v: next };
		editing = false;
		try {
			await onCommit(next);
		} catch {
			optimistic = null;
			new Notice(t("manage.updateFailed"));
		}
	}
</script>

{#if editing}
	<select
		class="pos-cell-select"
		value={display}
		onchange={(e) => void commit((e.target as HTMLSelectElement).value)}
		onblur={() => (editing = false)}
	>
		{#each options as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
{:else}
	<span
		class="pos-cell-badge pos-priority-badge {colorClass}"
		role="button"
		tabindex="0"
		onclick={() => (editing = true)}
		onkeydown={(e) => e.key === "Enter" && (editing = true)}
	>
		{#if icon}<span class="pos-priority-icon" aria-hidden="true">{icon}</span>{/if}
		{currentLabel()}
	</span>
{/if}
