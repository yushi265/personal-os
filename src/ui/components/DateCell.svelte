<script lang="ts">
	import { Notice } from "obsidian";
	import { t } from "../../i18n/ja";
	import { describeDue, today } from "../../domain/date";

	/**
	 * date inputのインライン編集セル(design-ui-first.md §3.1/§3.3)。空入力=削除(onCommitへundefinedを渡す)。
	 * relative=trueの場合、非編集時にdescribeDue()による相対表示+色を行う(due列専用。絶対日付はtitle属性で保持)。
	 */
	let {
		value,
		onCommit,
		relative = false,
	}: {
		value: string | undefined;
		onCommit: (next: string | undefined) => Promise<void>;
		relative?: boolean;
	} = $props();

	let editing = $state(false);
	let optimistic = $state<{ v: string | undefined } | null>(null);
	let draft = $state("");
	const display = $derived(optimistic ? optimistic.v : value);
	const dueInfo = $derived(relative && display ? describeDue(display, today()) : null);

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
{:else if dueInfo}
	<span
		class="pos-cell-text pos-due-{dueInfo.tone}"
		title={display}
		role="button"
		tabindex="0"
		onclick={startEdit}
		onkeydown={(e) => e.key === "Enter" && startEdit()}
	>
		{dueInfo.label}
	</span>
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
