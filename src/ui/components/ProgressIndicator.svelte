<script lang="ts">
	/**
	 * 進捗バー+%+分数の表示専用部品(Phase V1)。
	 * ManageRow/ActiveEntitiesWidget/Previewで重複していた同一マークアップを共通化したもの。
	 */
	let {
		progress,
		done,
		total,
	}: {
		progress: number;
		done: number;
		total: number;
	} = $props();
</script>

<div class="pos-progress-cell">
	<div class="pos-progress-bar" aria-label="{progress}%">
		<div class="pos-progress-bar-fill" style="width: {progress}%"></div>
	</div>
	<span class="pos-progress-label">{progress}% ({done}/{total})</span>
</div>
