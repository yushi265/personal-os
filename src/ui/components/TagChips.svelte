<script lang="ts">
	import { Notice } from "obsidian";
	import { t } from "../../i18n/ja";

	/**
	 * tags/labels共用のチップ入力UI(design-ui-first.md §4.6)。
	 * ManageRowのセルとは違いvalueが配列のため、editing切替は持たず常に編集可能な形で表示する。
	 * サジェストはAbstractInputSuggestではなくdatalistで代替する(Modal外のSvelte内では扱いにくいため、挙動同等の簡易実装で足りると判断)。
	 */
	let {
		values,
		suggestions,
		onCommit,
	}: {
		values: string[];
		suggestions: string[];
		onCommit: (next: string[]) => Promise<void>;
	} = $props();

	let optimistic = $state<string[] | null>(null);
	let draft = $state("");
	const display = $derived(optimistic ?? values);
	const listId = `pos-tagchips-${Math.random().toString(36).slice(2)}`;

	$effect(() => {
		if (optimistic && optimistic.join(",") === values.join(",")) optimistic = null;
	});

	async function commit(next: string[]): Promise<void> {
		optimistic = next;
		try {
			await onCommit(next);
		} catch {
			optimistic = null;
			new Notice(t("manage.updateFailed"));
		}
	}

	function addFromDraft(): void {
		const parts = draft
			.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
		draft = "";
		if (parts.length === 0) return;
		const next = [...display];
		for (const p of parts) if (!next.includes(p)) next.push(p);
		if (next.length !== display.length) void commit(next);
	}

	function removeAt(i: number): void {
		void commit(display.filter((_, idx) => idx !== i));
	}
</script>

<div class="pos-tagchips">
	{#each display as tag, i (tag + "#" + i)}
		<span class="pos-manage-chip pos-tagchips-chip">
			{tag}
			<button class="pos-tagchips-remove" aria-label={t("preview.tagChips.remove")} onclick={() => removeAt(i)}>×</button>
		</span>
	{/each}
	<input
		type="text"
		class="pos-tagchips-input"
		list={listId}
		placeholder={t("preview.tagChips.placeholder")}
		bind:value={draft}
		onblur={addFromDraft}
		onkeydown={(e) => {
			// IME変換確定のEnterで誤commitしない(確定テキストがdraftへ再挿入され入力欄に残る)
			if (e.isComposing) return;
			if (e.key === "Enter" || e.key === ",") {
				e.preventDefault();
				addFromDraft();
			}
		}}
	/>
	<datalist id={listId}>
		{#each suggestions as s (s)}
			<option value={s}></option>
		{/each}
	</datalist>
</div>
