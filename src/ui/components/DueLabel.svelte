<script lang="ts">
	import { describeDue, today } from "../../domain/date";

	/**
	 * 表示専用の相対期限ラベル(Phase V1)。DateCellのrelative表示・Dashboard各Widgetで
	 * 個別に書かれていたdescribeDue()呼び出しを共通化したもの。value未設定なら何も描画しない。
	 */
	let { value }: { value: string | undefined } = $props();
	const info = $derived(value ? describeDue(value, today()) : null);
</script>

{#if info}
	<span class="pos-due-label pos-due-{info.tone}" title={value}>{info.label}</span>
{/if}
