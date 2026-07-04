<script lang="ts">
	import { isValidInlineTitle } from "./manageData";

	/**
	 * 一覧最下行の常設インライン新規作成行(Linear/Notion方式、Phase U2)。
	 * アイドル時はラベルのみのボタン、クリック/フォーカスでtext inputに切り替わる。
	 * Enterで確定し、連続作成できるよう入力欄はクリアして開いたまま維持する。Escで閉じる。
	 * focusRequestTokenは外部(Manage.svelteの「n」キー)からこの行へフォーカスを要求するための外部トリガー
	 * (TitleCellのeditRequestTokenと同じパターン)。
	 */
	let {
		label,
		inputPlaceholder,
		onSubmit,
		focusRequestToken,
	}: {
		label: string;
		inputPlaceholder: string;
		onSubmit: (title: string) => void | Promise<void>;
		focusRequestToken?: number;
	} = $props();

	let editing = $state(false);
	let title = $state("");
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let lastToken: number | undefined;
	let sawFirstToken = false;

	$effect(() => {
		const token = focusRequestToken;
		if (token === undefined) return;
		if (!sawFirstToken) {
			sawFirstToken = true;
			lastToken = token;
			return;
		}
		if (token !== lastToken) {
			lastToken = token;
			startEditing();
		}
	});

	function startEditing(): void {
		editing = true;
		queueMicrotask(() => inputEl?.focus());
	}

	async function submit(): Promise<void> {
		if (!isValidInlineTitle(title)) return;
		const value = title.trim();
		title = "";
		await onSubmit(value);
		inputEl?.focus(); // 連続作成できるようフォーカスを維持する
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.isComposing) return;
		if (e.key === "Enter") {
			e.preventDefault();
			void submit();
		} else if (e.key === "Escape") {
			e.preventDefault();
			editing = false;
			title = "";
		}
	}

	function handleBlur(): void {
		if (!title.trim()) editing = false;
	}
</script>

{#if editing}
	<input
		type="text"
		class="pos-manage-inline-create-input"
		placeholder={inputPlaceholder}
		bind:value={title}
		bind:this={inputEl}
		onkeydown={handleKeydown}
		onblur={handleBlur}
	/>
{:else}
	<button type="button" class="pos-manage-inline-create-row" onclick={startEditing} onfocus={startEditing}>
		{label}
	</button>
{/if}
