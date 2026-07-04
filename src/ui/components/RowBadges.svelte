<script lang="ts">
	import { rowBadgeBlockerTitle, rowBadgeCommentTitle, rowBadgeTodoTitle } from "../../i18n/ja";

	/** ManageRowの行バッジ(design: 行バッジの情報密度アップ)。0件のバッジは表示しない */
	let {
		blockerCount,
		commentCount,
		todoCount,
	}: {
		blockerCount: number;
		commentCount: number;
		todoCount: number;
	} = $props();
</script>

{#if blockerCount > 0 || commentCount > 0 || todoCount > 0}
	<span class="pos-row-badges">
		{#if blockerCount > 0}
			<span class="pos-row-badge pos-row-badge-blocker" title={rowBadgeBlockerTitle(blockerCount)}>
				⛔ {blockerCount}
			</span>
		{/if}
		{#if commentCount > 0}
			<span class="pos-row-badge" title={rowBadgeCommentTitle(commentCount)}>💬 {commentCount}</span>
		{/if}
		{#if todoCount > 0}
			<span class="pos-row-badge" title={rowBadgeTodoTitle(todoCount)}>☑ {todoCount}</span>
		{/if}
	</span>
{/if}
