<script lang="ts">
	import { Menu, Platform } from "obsidian";
	import type { Comment } from "../../domain/comment";
	import type PersonalOSPlugin from "../../main";
	import { commentDeletedUndoNotice, t } from "../../i18n/ja";
	import { showUndoNotice } from "../undoNotice";
	import { longpress } from "../longpress";

	/**
	 * タイムスタンプ付きコメントの共通表示・操作部品(design-memo.md §4.1。旧称: MemoSection)。
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

	let comments = $state<Comment[]>([]);
	let visibleCount = $state(10); // 「もっと見る」用(要件§3.1)
	let editingIndex = $state<number | null>(null); // sorted配列内のindex
	let editText = $state("");
	let newText = $state("");
	let addTextareaEl: HTMLTextAreaElement | undefined;

	let loadToken = 0;
	async function reload(): Promise<void> {
		const token = ++loadToken;
		const next = await plugin.commentService.list(path);
		if (token !== loadToken) return; // pathが切り替わった後に古い結果が届いた場合は破棄
		comments = next;
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

	const sorted = $derived([...comments].reverse()); // 新しい順(要件§1.2)
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
		await plugin.commentService.add(path, text);
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

	function startEdit(index: number, comment: Comment): void {
		editingIndex = index;
		editText = comment.text;
	}

	function cancelEdit(): void {
		editingIndex = null;
		editText = "";
	}

	async function submitEdit(comment: Comment): Promise<void> {
		const next = editText.trim();
		if (!next) return;
		const result = await plugin.commentService.update(path, comment, next);
		editingIndex = null;
		editText = "";
		if (result === "conflict") return; // Notice済み。以降のreloadは共通処理へ
		await reload();
	}

	function handleEditKeydown(e: KeyboardEvent, comment: Comment): void {
		if (e.key === "Escape") {
			e.preventDefault();
			cancelEdit();
			return;
		}
		if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			void submitEdit(comment);
		}
	}

	async function requestRemove(comment: Comment): Promise<void> {
		await plugin.commentService.remove(path, comment);
		await reload(); // ok/conflictいずれの場合も最新化
		showUndoNotice(commentDeletedUndoNotice(comment.text), async () => {
			await plugin.commentService.restore(path, comment);
			await reload();
		});
	}

	function showMore(): void {
		visibleCount += 10;
	}

	// モバイル(design: モバイル長押しメニュー化): 長押しで編集/削除のMenuを出す。デスクトップのボタンと同じ操作を代替する
	function openCommentMenu(comment: Comment, index: number, x: number, y: number): void {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(t("comment.edit")).onClick(() => startEdit(index, comment)));
		menu.addItem((item) => item.setTitle(t("comment.delete")).onClick(() => void requestRemove(comment)));
		menu.showAtPosition({ x, y });
	}
</script>

<div class="pos-comment-section">
	<form
		class="pos-comment-add"
		onsubmit={(e) => {
			e.preventDefault();
			void submitAdd();
		}}
	>
		<textarea
			class="pos-comment-add-text"
			rows="1"
			placeholder={t("comment.placeholder")}
			bind:value={newText}
			bind:this={addTextareaEl}
			oninput={() => autosize(addTextareaEl)}
			onkeydown={handleAddKeydown}
		></textarea>
		<button type="submit" class="pos-manage-new-btn">{t("comment.add")}</button>
	</form>

	{#if visible.length === 0}
		<p class="pos-widget-empty">{t("comment.empty")}</p>
	{:else}
		<ul class="pos-comment-list">
			{#each visible as comment, i (i)}
				<li
					class="pos-comment-item"
					use:longpress={{ enabled: Platform.isMobile, onLongPress: (x, y) => openCommentMenu(comment, i, x, y) }}
				>
					{#if editingIndex === i}
						<textarea
							class="pos-comment-edit-text"
							rows="1"
							bind:value={editText}
							use:autosizeAction
							onkeydown={(e) => handleEditKeydown(e, comment)}
						></textarea>
					{:else}
						<div class="pos-comment-item-header">
							<span class="pos-comment-datetime">{comment.datetime}</span>
							<span class="pos-comment-item-actions">
								<button class="pos-comment-action" onclick={() => startEdit(i, comment)}>{t("comment.edit")}</button>
								<button class="pos-comment-action pos-btn-danger-ghost" onclick={() => requestRemove(comment)}>{t("comment.delete")}</button>
							</span>
						</div>
						<p class="pos-comment-text">{comment.text}</p>
					{/if}
				</li>
			{/each}
		</ul>
		{#if hasMore}
			<button class="pos-manage-new-btn" onclick={showMore}>{t("comment.showMore")}</button>
		{/if}
	{/if}
</div>
