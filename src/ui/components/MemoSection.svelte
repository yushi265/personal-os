<script lang="ts">
	import type { Memo } from "../../domain/memo";
	import type PersonalOSPlugin from "../../main";
	import { memoDeleteConfirmMessage, t } from "../../i18n/ja";
	import { ConfirmModal } from "../modals/ConfirmModal";

	/**
	 * タイムスタンプ付きメモの共通表示・操作部品(design-memo.md §4.1)。
	 * Preview.svelte/TicketDetailScreen.svelte/ProjectDetailScreen.svelteの3箇所から使う。
	 * IndexStoreを経由しないため、pathを受け取り自分の力で非同期読込を完結させる(§4.2)。
	 * capability(todoFeatures)判定は持たない。呼び出し元の{#if}にも含めない(要件§3.3)。
	 */
	let {
		plugin,
		path,
	}: {
		plugin: PersonalOSPlugin;
		path: string;
	} = $props();

	let memos = $state<Memo[]>([]);
	let visibleCount = $state(10); // 「もっと見る」用(要件§3.1)
	let editingIndex = $state<number | null>(null); // sorted配列内のindex
	let editText = $state("");
	let newText = $state("");
	let addTextareaEl: HTMLTextAreaElement | undefined;

	let loadToken = 0;
	async function reload(): Promise<void> {
		const token = ++loadToken;
		const next = await plugin.memoService.list(path);
		if (token !== loadToken) return; // pathが切り替わった後に古い結果が届いた場合は破棄
		memos = next;
	}

	$effect(() => {
		path; // pathが変わるたびに再読込(画面遷移で埋め込み対象が変わるケース)
		visibleCount = 10;
		editingIndex = null;
		void reload();
	});

	// 外部編集(手書き・他ウィンドウ)の反映専用。自分の書き込み後はSelfWriteGuardによりこのイベントが
	// 飛んでこないため、add/update/removeの直後は明示的にreload()を呼ぶ(design-memo.md §4.2)
	$effect(() => {
		const ref = plugin.eventBus.onEvent("index-updated", () => void reload());
		return () => plugin.eventBus.offref(ref);
	});

	const sorted = $derived([...memos].reverse()); // 新しい順(要件§1.2)
	const visible = $derived(sorted.slice(0, visibleCount));
	const hasMore = $derived(sorted.length > visibleCount);

	function autosize(el: HTMLTextAreaElement | undefined): void {
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${el.scrollHeight}px`;
	}

	/** editingIndex用textarea: 生成直後に既存の複数行本文へ合わせて高さを合わせる(要素はeach再生成のたびに作り直される) */
	function autosizeAction(node: HTMLTextAreaElement): { destroy: () => void } {
		const resize = () => autosize(node);
		resize();
		node.addEventListener("input", resize);
		return { destroy: () => node.removeEventListener("input", resize) };
	}

	async function submitAdd(): Promise<void> {
		const text = newText.trim();
		if (!text) return;
		await plugin.memoService.add(path, text);
		newText = "";
		await reload(); // 自分の書き込みはindex-updatedが発火しないため明示的に再読込(§4.2)
		autosize(addTextareaEl);
	}

	function handleAddKeydown(e: KeyboardEvent): void {
		if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			void submitAdd();
		}
	}

	function startEdit(index: number, memo: Memo): void {
		editingIndex = index;
		editText = memo.text;
	}

	function cancelEdit(): void {
		editingIndex = null;
		editText = "";
	}

	async function submitEdit(memo: Memo): Promise<void> {
		const next = editText.trim();
		if (!next) return;
		const result = await plugin.memoService.update(path, memo, next);
		editingIndex = null;
		editText = "";
		if (result === "conflict") return; // Notice済み。以降のreloadは共通処理へ
		await reload();
	}

	function handleEditKeydown(e: KeyboardEvent, memo: Memo): void {
		if (e.key === "Escape") {
			e.preventDefault();
			cancelEdit();
			return;
		}
		if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			void submitEdit(memo);
		}
	}

	function requestRemove(memo: Memo): void {
		new ConfirmModal(plugin.app, {
			message: memoDeleteConfirmMessage(memo.text),
			onConfirm: async () => {
				await plugin.memoService.remove(path, memo);
				await reload(); // ok/conflictいずれの場合も最新化
			},
		}).open();
	}

	function showMore(): void {
		visibleCount += 10;
	}
</script>

<div class="pos-memo-section">
	<form
		class="pos-memo-add"
		onsubmit={(e) => {
			e.preventDefault();
			void submitAdd();
		}}
	>
		<textarea
			class="pos-memo-add-text"
			rows="1"
			placeholder={t("memo.placeholder")}
			bind:value={newText}
			bind:this={addTextareaEl}
			oninput={() => autosize(addTextareaEl)}
			onkeydown={handleAddKeydown}
		></textarea>
		<button type="submit" class="pos-manage-new-btn">{t("memo.add")}</button>
	</form>

	{#if visible.length === 0}
		<p class="pos-widget-empty">{t("memo.empty")}</p>
	{:else}
		<ul class="pos-memo-list">
			{#each visible as memo, i (i)}
				<li class="pos-memo-item">
					{#if editingIndex === i}
						<textarea
							class="pos-memo-edit-text"
							rows="1"
							bind:value={editText}
							use:autosizeAction
							onkeydown={(e) => handleEditKeydown(e, memo)}
						></textarea>
					{:else}
						<div class="pos-memo-item-header">
							<span class="pos-memo-datetime">{memo.datetime}</span>
							<span class="pos-memo-item-actions">
								<button class="pos-memo-action" onclick={() => startEdit(i, memo)}>{t("memo.edit")}</button>
								<button class="pos-memo-action mod-warning" onclick={() => requestRemove(memo)}>{t("memo.delete")}</button>
							</span>
						</div>
						<p class="pos-memo-text">{memo.text}</p>
					{/if}
				</li>
			{/each}
		</ul>
		{#if hasMore}
			<button class="pos-manage-new-btn" onclick={showMore}>{t("memo.showMore")}</button>
		{/if}
	{/if}
</div>
