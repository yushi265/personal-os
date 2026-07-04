<script lang="ts">
	import { Notice } from "obsidian";
	import { t } from "../../i18n/ja";

	/**
	 * クリック→text input(Enter確定/Esc取消/フォーカスアウト確定)のインライン編集セル(design-ui-first.md §3.1/§3.3)。
	 * Entityのtitle(rename)とTodoのtext編集の両方から{value, onCommit}のみで再利用する。
	 */
	let {
		value,
		onCommit,
		onCancel,
	}: {
		value: string;
		onCommit: (next: string) => Promise<void>;
		onCancel?: () => void;
	} = $props();

	let editing = $state(false);
	let optimistic = $state<{ v: string } | null>(null);
	let draft = $state("");
	const display = $derived(optimistic ? optimistic.v : value);

	$effect(() => {
		if (optimistic && value === optimistic.v) optimistic = null;
	});

	function startEdit(): void {
		draft = display;
		editing = true;
	}

	async function commit(): Promise<void> {
		if (!editing) return;
		const trimmed = draft.trim();
		editing = false;
		if (!trimmed || trimmed === display) {
			onCancel?.();
			return;
		}
		optimistic = { v: trimmed };
		try {
			await onCommit(trimmed);
		} catch {
			optimistic = null;
			new Notice(t("manage.updateFailed"));
		}
	}

	function cancel(): void {
		editing = false;
		onCancel?.();
	}
</script>

{#if editing}
	<input
		type="text"
		class="pos-cell-text-input"
		bind:value={draft}
		onblur={commit}
		onkeydown={(e) => {
			if (e.key === "Enter") void commit();
			if (e.key === "Escape") cancel();
		}}
	/>
{:else}
	<span
		class="pos-cell-text pos-cell-title"
		role="button"
		tabindex="0"
		onclick={startEdit}
		onkeydown={(e) => e.key === "Enter" && startEdit()}
	>
		{display}
	</span>
{/if}
