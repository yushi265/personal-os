<script lang="ts">
	import { Notice } from "obsidian";
	import { t } from "../../i18n/ja";

	/** date inputのインライン編集セル(design-ui-first.md §3.1/§3.3)。空入力=削除(onCommitへundefinedを渡す) */
	let {
		value,
		onCommit,
	}: {
		value: string | undefined;
		onCommit: (next: string | undefined) => Promise<void>;
	} = $props();

	let editing = $state(false);
	let optimistic = $state<{ v: string | undefined } | null>(null);
	let draft = $state("");
	const display = $derived(optimistic ? optimistic.v : value);

	$effect(() => {
		if (optimistic && value === optimistic.v) optimistic = null;
	});

	function startEdit(): void {
		draft = display ?? "";
		editing = true;
	}

	async function commit(): Promise<void> {
		if (!editing) return;
		const next = draft || undefined;
		optimistic = { v: next };
		editing = false;
		try {
			await onCommit(next);
		} catch {
			optimistic = null;
			new Notice(t("manage.updateFailed"));
		}
	}

	function cancel(): void {
		editing = false;
	}
</script>

{#if editing}
	<input
		type="date"
		class="pos-cell-date-input"
		value={draft}
		onchange={(e) => (draft = (e.target as HTMLInputElement).value)}
		onblur={commit}
		onkeydown={(e) => {
			if (e.key === "Enter") void commit();
			if (e.key === "Escape") cancel();
		}}
	/>
{:else}
	<span
		class="pos-cell-text"
		role="button"
		tabindex="0"
		onclick={startEdit}
		onkeydown={(e) => e.key === "Enter" && startEdit()}
	>
		{display ?? ""}
	</span>
{/if}
