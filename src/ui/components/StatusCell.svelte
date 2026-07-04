<script lang="ts">
	import { Notice } from "obsidian";
	import { t } from "../../i18n/ja";

	/**
	 * バッジ表示⇔selectのインライン編集セル(design-ui-first.md §3.1/§3.3)。
	 * ManageRow/Preview双方から{value, options, onCommit}のみで再利用できる。
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
	// 楽観的更新の一時的な上書き。nullの間はvalue(prop)をそのまま表示し、
	// 書き込み成功後はpropが追従するまでの間だけこの値を見せる(design-ui-first.md §3.3)。
	let optimistic = $state<{ v: string } | null>(null);
	const display = $derived(optimistic ? optimistic.v : value);

	$effect(() => {
		if (optimistic && value === optimistic.v) optimistic = null;
	});

	function currentLabel(): string {
		return options.find((o) => o.value === display)?.label ?? display;
	}

	// statusの意味カテゴリでバッジ色を分ける(design-ui-first.md追補: UI磨き込み Phase N5)。
	// 未知のstatus値は"default"にフォールバックする。
	const STATUS_COLOR_CLASS: Record<string, string> = {
		doing: "pos-status-accent",
		active: "pos-status-accent",
		waiting: "pos-status-warning",
		review: "pos-status-review",
		done: "pos-status-done",
		archived: "pos-status-done",
	};
	const colorClass = $derived(STATUS_COLOR_CLASS[display] ?? "pos-status-default");

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
		class="pos-cell-badge pos-status-badge {colorClass}"
		role="button"
		tabindex="0"
		onclick={() => (editing = true)}
		onkeydown={(e) => e.key === "Enter" && (editing = true)}
	>
		{currentLabel()}
	</span>
{/if}
