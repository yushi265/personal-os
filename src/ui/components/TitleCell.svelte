<script lang="ts">
	import { Notice, type App } from "obsidian";
	import { t } from "../../i18n/ja";
	import { triggerHoverPreview } from "../hoverPreview";

	/**
	 * クリック→text input(Enter確定/Esc取消/フォーカスアウト確定)のインライン編集セル(design-ui-first.md §3.1/§3.3)。
	 * Entityのtitle(rename)とTodoのtext編集の両方から{value, onCommit}のみで再利用する。
	 *
	 * onNavigateを渡すと一覧行での用途になり、テキストはクリックで遷移するリンク表示になる
	 * (design-drilldown-nav.md 追補: 遷移導線の明確化)。編集開始はホバーで現れる鉛筆アイコンから行う。
	 * editRequestTokenは呼び出し側(RowMenuの「名前を変更」)から編集開始を指示するための外部トリガー。
	 * 値が変化するたびに編集モードへ入る。
	 */
	let {
		value,
		onCommit,
		onCancel,
		onNavigate,
		editRequestToken,
		app,
		hoverSourcePath,
	}: {
		value: string;
		onCommit: (next: string) => Promise<void>;
		onCancel?: () => void;
		onNavigate?: () => void;
		editRequestToken?: number;
		/** Ctrl/Cmd+ホバーでのネイティブページプレビュー用(Phase U3)。両方渡された場合のみ有効化する */
		app?: App;
		hoverSourcePath?: string;
	} = $props();

	function onTitleHover(e: MouseEvent): void {
		if (!app || !hoverSourcePath) return;
		triggerHoverPreview(app, e, e.currentTarget as HTMLElement, hoverSourcePath);
	}

	let editing = $state(false);
	let optimistic = $state<{ v: string } | null>(null);
	let draft = $state("");
	const display = $derived(optimistic ? optimistic.v : value);
	let lastEditRequestToken: number | undefined;
	let sawFirstEditRequestToken = false;

	$effect(() => {
		if (optimistic && value === optimistic.v) optimistic = null;
	});

	$effect(() => {
		const token = editRequestToken;
		if (token === undefined) return;
		if (!sawFirstEditRequestToken) {
			sawFirstEditRequestToken = true;
			lastEditRequestToken = token;
			return;
		}
		if (token !== lastEditRequestToken) {
			lastEditRequestToken = token;
			startEdit();
		}
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
{:else if onNavigate}
	<span class="pos-title-cell-nav">
		<!-- svelte-ignore a11y_mouse_events_have_key_events -- ホバープレビュー(Phase U3)はマウス専用のプログレッシブエンハンスメント。キーボード操作はonclick/onkeydownのEnterで別途担保済み -->
		<span
			class="pos-cell-text pos-cell-title pos-title-link pos-truncate"
			role="link"
			tabindex="0"
			title={display}
			onclick={() => onNavigate?.()}
			onkeydown={(e) => e.key === "Enter" && onNavigate?.()}
			onmouseover={onTitleHover}
		>
			{display}
		</span>
		<button type="button" class="pos-title-edit-btn" aria-label={t("manage.nav.editTitle")} onclick={startEdit}>✎</button>
	</span>
{:else}
	<!-- svelte-ignore a11y_mouse_events_have_key_events -- ホバープレビュー(Phase U3)はマウス専用のプログレッシブエンハンスメント。キーボード操作はonclick/onkeydownのEnterで別途担保済み -->
	<span
		class="pos-cell-text pos-cell-title pos-truncate"
		role="button"
		tabindex="0"
		title={display}
		onclick={startEdit}
		onkeydown={(e) => e.key === "Enter" && startEdit()}
		onmouseover={onTitleHover}
	>
		{display}
	</span>
{/if}
