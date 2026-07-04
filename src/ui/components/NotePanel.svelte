<script lang="ts">
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";

	/**
	 * シンプルメモの表示・編集部品(design-reorder-and-notes.md 機能B-3)。
	 * Preview.svelte/TicketDetailScreen.svelte/ProjectDetailScreen.svelteの3箇所から、CommentSectionより上に配置する。
	 * 1エンティティ1本文・全文上書きのためconflict概念を持たず、フォーカスアウトで自動保存する。
	 */
	let {
		plugin,
		path,
	}: {
		plugin: PersonalOSPlugin;
		path: string;
	} = $props();

	let text = $state("");
	let savedText = ""; // 直近読込/保存時点の内容。blur時にこれと異なる場合のみ保存する
	let statusText = $state("");
	let textareaEl: HTMLTextAreaElement | undefined;
	let statusTimer: ReturnType<typeof setTimeout> | undefined;

	let loadToken = 0;
	async function reload(): Promise<void> {
		const token = ++loadToken;
		const next = await plugin.noteService.get(path);
		if (token !== loadToken) return; // pathが切り替わった後に古い結果が届いた場合は破棄
		text = next;
		savedText = next;
		queueMicrotask(() => autosize(textareaEl));
	}

	$effect(() => {
		path; // pathが変わるたびに再読込(画面遷移で埋め込み対象が変わるケース)
		statusText = "";
		void reload();
	});

	// 外部編集(手書き・他ウィンドウ)の反映専用。自分の書き込み後はSelfWriteGuardによりこのイベントが
	// 飛んでこないため、blur保存の直後は明示的にreload()を呼ばない(savedTextを直接更新する)
	$effect(() => {
		const ref = plugin.eventBus.onEvent("index-updated", () => void reload());
		return () => plugin.eventBus.offref(ref);
	});

	function autosize(el: HTMLTextAreaElement | undefined): void {
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${el.scrollHeight}px`;
	}

	function showSavedIndicator(): void {
		statusText = t("note.saved");
		if (statusTimer) clearTimeout(statusTimer);
		statusTimer = setTimeout(() => {
			statusText = "";
		}, 1500);
	}

	async function handleBlur(): Promise<void> {
		if (text === savedText) return; // 変更がなければ保存しない
		const toSave = text;
		await plugin.noteService.save(path, toSave);
		savedText = toSave;
		showSavedIndicator();
	}
</script>

<div class="pos-note-section">
	<textarea
		class="pos-note-textarea"
		bind:value={text}
		bind:this={textareaEl}
		placeholder={t("note.placeholder")}
		oninput={() => autosize(textareaEl)}
		onblur={() => void handleBlur()}
	></textarea>
	<span class="pos-note-status">{statusText}</span>
</div>
