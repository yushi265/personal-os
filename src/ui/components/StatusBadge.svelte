<script lang="ts">
	import { statusColorClass } from "./badgeStyles";

	/**
	 * 表示専用のstatusバッジ(design-ui-first.md追補: UI磨き込み Phase V1)。
	 * 編集操作はStatusCellが担当するため、Dashboard/Previewの一覧行など「表示のみでよい」箇所から使う。
	 */
	let { value, label }: { value: string; label: string } = $props();
	const colorClass = $derived(statusColorClass(value));
</script>

<span class="pos-status-badge {colorClass}">{label}</span>
