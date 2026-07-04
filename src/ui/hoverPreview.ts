import type { App } from "obsidian";

/**
 * Ctrl/Cmd+ホバーでObsidianネイティブのページプレビューを表示する(Phase U3)。
 * 管理Viewの一覧タイトル・パンくず・詳細ヘッダタイトルのmouseoverハンドラから共通で呼ぶ。
 * hoverParentは呼び出しごとの使い捨てオブジェクトで良い(Obsidian側がポップオーバー参照を書き込む置き場所として使うだけ)。
 */
export function triggerHoverPreview(app: App, event: MouseEvent, targetEl: HTMLElement, path: string): void {
	if (!event.ctrlKey && !event.metaKey) return;
	const hoverParent: { hoverPopover: unknown } = { hoverPopover: null };
	app.workspace.trigger("hover-link", {
		event,
		source: "pos-manage",
		hoverParent,
		targetEl,
		linktext: path,
		sourcePath: path,
	});
}
