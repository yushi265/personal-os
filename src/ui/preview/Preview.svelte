<script lang="ts">
	import type { Writable } from "svelte/store";
	import type PersonalOSPlugin from "../../main";
	import { t } from "../../i18n/ja";
	import type { PreviewData } from "./PreviewView";

	let {
		plugin,
		data,
	}: {
		plugin: PersonalOSPlugin;
		data: Writable<PreviewData>;
	} = $props();

	function openPath(path: string): void {
		void plugin.app.workspace.openLinkText(path, "", false);
	}

	function titleOf(path: string): string {
		return plugin.store.get(path)?.title ?? path;
	}
</script>

<div class="pos-preview">
	{#if $data.entity === null}
		<p class="pos-widget-empty">{t("preview.empty")}</p>
	{:else}
		{@const entity = $data.entity}
		<h2 class="pos-preview-title">{entity.title}</h2>

		<details class="pos-preview-section" open>
			<summary>{t("preview.section.detail")}</summary>
			<dl class="pos-preview-fields">
				<dt>{t("preview.field.type")}</dt>
				<dd>{entity.type}</dd>
				<dt>{t("preview.field.status")}</dt>
				<dd>{entity.status}</dd>
				{#if entity.priority}
					<dt>{t("preview.field.priority")}</dt>
					<dd>{entity.priority}</dd>
				{/if}
				{#if entity.type === "project" || entity.type === "ticket"}
					<dt>{t("preview.field.progress")}</dt>
					<dd>
						<div class="pos-progress-bar" aria-label="{entity.progress ?? 0}%">
							<div class="pos-progress-bar-fill" style="width: {entity.progress ?? 0}%"></div>
						</div>
						{entity.progress ?? 0}%
					</dd>
				{/if}
				{#if entity.due}
					<dt>{t("preview.field.due")}</dt>
					<dd>{entity.due}</dd>
				{/if}
				{#if entity.goal}
					<dt>{t("preview.field.goal")}</dt>
					<dd>
						<span role="link" tabindex="0" onclick={() => openPath(entity.goal!)} onkeydown={(e) => e.key === "Enter" && openPath(entity.goal!)}>
							{titleOf(entity.goal)}
						</span>
					</dd>
				{/if}
				{#if entity.project}
					<dt>{t("preview.field.project")}</dt>
					<dd>
						<span role="link" tabindex="0" onclick={() => openPath(entity.project!)} onkeydown={(e) => e.key === "Enter" && openPath(entity.project!)}>
							{titleOf(entity.project)}
						</span>
					</dd>
				{/if}
			</dl>
		</details>

		{#if entity.blockers.length > 0}
			<details class="pos-preview-section" open>
				<summary>{t("preview.section.blockers")}</summary>
				<ul class="pos-widget-list">
					{#each entity.blockers as blocker, i (i)}
						<li class="pos-widget-item">{blocker}</li>
					{/each}
				</ul>
			</details>
		{/if}

		<details class="pos-preview-section">
			<summary>{t("preview.section.children")}</summary>
			{#if $data.children.length === 0}
				<p class="pos-widget-empty">{t("preview.empty.children")}</p>
			{:else}
				<ul class="pos-widget-list">
					{#each $data.children as child (child.path)}
						<li class="pos-widget-item">
							<span
								class="pos-widget-item-text"
								role="link"
								tabindex="0"
								onclick={() => openPath(child.path)}
								onkeydown={(e) => e.key === "Enter" && openPath(child.path)}
							>
								▸ {child.title} ({child.status})
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</details>

		<details class="pos-preview-section">
			<summary>{t("preview.section.todos")}</summary>
			{#if $data.todos.length === 0}
				<p class="pos-widget-empty">{t("preview.empty.todos")}</p>
			{:else}
				<ul class="pos-widget-list">
					{#each $data.todos as todo (todo.filePath + "#" + todo.line)}
						<li class="pos-widget-item">
							<input type="checkbox" checked={todo.done} disabled />
							<span class="pos-widget-item-text">{todo.text}</span>
							{#if todo.dueDate}<span class="pos-widget-due">📅 {todo.dueDate}</span>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</details>
	{/if}
</div>
