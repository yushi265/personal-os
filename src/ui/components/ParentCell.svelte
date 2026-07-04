<script lang="ts">
	import { Notice } from "obsidian";
	import { t } from "../../i18n/ja";

	/**
	 * goal/projectドロップダウン(design-ui-first.md §3.1/§3.3)。
	 * 候補は呼び出し側(ManageRow/Preview)が渡す。空選択=解除(onCommitへundefined)。
	 */
	let {
		value,
		options,
		onCommit,
	}: {
		value: string | undefined;
		options: { value: string; label: string }[];
		onCommit: (next: string | undefined) => Promise<void>;
	} = $props();

	let editing = $state(false);
	let optimistic = $state<{ v: string | undefined } | null>(null);
	const display = $derived(optimistic ? optimistic.v : value);

	$effect(() => {
		if (optimistic && value === optimistic.v) optimistic = null;
	});

	function currentLabel(): string {
		if (!display) return "";
		return options.find((o) => o.value === display)?.label ?? display;
	}

	async function commit(next: string): Promise<void> {
		const nextValue = next || undefined;
		optimistic = { v: nextValue };
		editing = false;
		try {
			await onCommit(nextValue);
		} catch {
			optimistic = null;
			new Notice(t("manage.updateFailed"));
		}
	}
</script>

{#if editing}
	<select
		class="pos-cell-select"
		value={display ?? ""}
		onchange={(e) => void commit((e.target as HTMLSelectElement).value)}
		onblur={() => (editing = false)}
	>
		<option value="">{t("manage.field.unset")}</option>
		{#each options as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
{:else}
	<span
		class="pos-cell-badge"
		role="button"
		tabindex="0"
		onclick={() => (editing = true)}
		onkeydown={(e) => e.key === "Enter" && (editing = true)}
	>
		{currentLabel()}
	</span>
{/if}
