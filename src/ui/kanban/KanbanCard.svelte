<script lang="ts">
	import { Menu, Platform } from "obsidian";
	import type { Entity } from "../../domain/entity";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import { entityProgressFraction } from "../manage/manageData";
	import PriorityLabel from "../components/PriorityLabel.svelte";
	import DueLabel from "../components/DueLabel.svelte";
	import ProgressIndicator from "../components/ProgressIndicator.svelte";

	let {
		plugin,
		entity,
		statuses,
		columnNames,
		onNavigate,
		onOpenNote,
		onMove,
	}: {
		plugin: PersonalOSPlugin;
		entity: Entity;
		statuses: readonly string[];
		columnNames: Record<string, string>;
		/** カードクリック本体: 管理View詳細へ遷移(design-drilldown-nav.mdと同じ操作言語) */
		onNavigate: (path: string, modifierClick: boolean) => void;
		/** 「⋮」メニューからのみ: ノートを直接開く */
		onOpenNote: (path: string) => void;
		onMove: (path: string, status: string) => void;
	} = $props();

	const fraction = $derived(entityProgressFraction(plugin.store, entity));
	const commentCount = $derived(plugin.store.getCommentCount(entity.path));

	let dragging = $state(false);

	function handleDragStart(e: DragEvent): void {
		e.dataTransfer?.setData("text/plain", entity.path);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		dragging = true;
	}

	function handleDragEnd(): void {
		dragging = false;
	}

	function openCardMenu(e: MouseEvent): void {
		e.stopPropagation();
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(t("manage.rowMenu.openNote")).onClick(() => onOpenNote(entity.path)));
		menu.addSeparator();
		for (const status of statuses) {
			if (status === entity.status) continue;
			menu.addItem((item) =>
				item.setTitle(`▸ ${columnNames[status] ?? status}`).onClick(() => onMove(entity.path, status))
			);
		}
		menu.showAtMouseEvent(e);
	}
</script>

<div
	class="pos-kanban-card"
	class:pos-kanban-card-dragging={dragging}
	draggable={!Platform.isMobile}
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	onclick={(e) => onNavigate(entity.path, e.metaKey || e.ctrlKey)}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === "Enter" && onNavigate(entity.path, e.metaKey || e.ctrlKey)}
>
	<button class="pos-kanban-card-menu" onclick={openCardMenu} aria-label={t("kanban.cardMenuLabel")}>⋮</button>
	<div class="pos-kanban-card-title pos-truncate" title={entity.title}>{entity.title}</div>
	<div class="pos-kanban-card-meta">
		<PriorityLabel value={entity.priority ?? ""} label={entity.priority ?? ""} />
		<DueLabel value={entity.due} />
		{#if commentCount > 0}
			<span class="pos-row-badge">💬 {commentCount}</span>
		{/if}
	</div>
	<ProgressIndicator progress={entity.progress ?? 0} done={fraction.done} total={fraction.total} />
</div>
