<script lang="ts">
	import { PRIORITY_ICON, priorityColorClass } from "./badgeStyles";

	/**
	 * 表示専用のpriorityラベル(Phase V1)。value未設定(空文字)の場合は何も描画しない
	 * (一覧行では優先度が付いている項目だけ目立たせれば十分なため)。
	 */
	let { value, label }: { value: string; label: string } = $props();
	const colorClass = $derived(priorityColorClass(value));
	const icon = $derived(value ? (PRIORITY_ICON[value] ?? "") : "");
</script>

{#if value}
	<span class="pos-priority-badge {colorClass}">
		{#if icon}<span class="pos-priority-icon" aria-hidden="true">{icon}</span>{/if}
		{label}
	</span>
{/if}
